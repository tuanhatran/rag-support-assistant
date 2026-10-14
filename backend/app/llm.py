from __future__ import annotations

import logging
from urllib.parse import urlsplit

import httpx

from app.errors import ConfigurationError
from app.redaction import redact


logger = logging.getLogger(__name__)


def _log_upstream_error(provider: str, status_code: int, response_text: str) -> None:
    logger.error("LLM upstream returned error response", extra={"fields": {
        "provider": provider, "status_code": status_code,
        "upstream_error": redact(response_text)[:300],
    }})


SYSTEM_PROMPT = ("You are an IT troubleshooting support assistant. Answer ONLY from the supplied context. "
                 "Use concise Markdown steps and cite sources as [n]. If context lacks the answer, say so and suggest a ticket. "
                 "Never invent commands, settings, or URLs.")


def is_keyless_ollama(connection: dict) -> bool:
    if connection.get("provider") != "openai":
        return False
    try:
        endpoint = urlsplit(connection.get("base_url", ""))
        hostname = (endpoint.hostname or "").lower()
        port = endpoint.port
    except ValueError:
        return False
    return (endpoint.scheme == "http" and endpoint.path.rstrip("/") == "/v1"
            and not endpoint.username and not endpoint.password
            and not endpoint.query and not endpoint.fragment and port == 11434
            and hostname in {"localhost", "127.0.0.1", "::1", "host.docker.internal"})


def build_messages(question: str, sources: list[dict], history: list[dict]) -> list[dict]:
    context = "\n\n".join(f"[{index}] {source['document_title']} > {source['section']}\n{source['text']}"
                            for index, source in enumerate(sources, start=1))
    messages = [{"role": "system", "content": SYSTEM_PROMPT + "\n\nContext:\n" + (context or "No relevant documents found.")}]
    for message in history[-6:]:
        messages.extend([{"role": "user", "content": message["question"]},
                         {"role": "assistant", "content": message["answer"]}])
    messages.append({"role": "user", "content": question})
    return messages


def mock_answer(sources: list[dict]) -> str:
    if not sources:
        return "_(simulated answer)_\n\nI couldn't find a matching runbook section. Please open an IT support ticket with the error and steps already tried."
    first, *related = sources
    answer = ("_(simulated answer)_\n\nAccording to **" + first["document_title"] + " > " + first["section"] + "** [1]:\n\n" +
              first["text"][:900])
    if related:
        answer += "\n\n**Related sections:** " + "; ".join(f"{item['document_title']} > {item['section']} [{i}]" for i, item in enumerate(related, 2))
    return answer


async def complete(connection: dict, api_key: str, messages: list[dict], timeout: int,
                   transport: httpx.AsyncBaseTransport | None = None) -> str:
    provider = connection["provider"]
    base = connection.get("base_url", "").rstrip("/")
    headers = {}
    if provider == "openai":
        base = base or "https://api.openai.com/v1"
        if not api_key and not is_keyless_ollama(connection):
            raise ConfigurationError("An API key is required for this OpenAI-compatible endpoint")
        url = base + "/chat/completions"
        if api_key:
            headers = {"Authorization": f"Bearer {api_key}"}
        payload = {"model": connection["model"], "messages": messages,
                   "temperature": connection.get("temperature", 0.2), "max_tokens": connection.get("max_tokens", 1200)}
    elif provider == "azure_openai":
        if not base or not connection.get("api_version"):
            raise ConfigurationError("Azure OpenAI requires a base URL and API version")
        url = f"{base}/openai/deployments/{connection['model']}/chat/completions?api-version={connection['api_version']}"
        headers = {"api-key": api_key}
        payload = {"messages": messages, "temperature": connection.get("temperature", 0.2),
                   "max_tokens": connection.get("max_tokens", 1200)}
    elif provider == "anthropic":
        base = base or "https://api.anthropic.com"
        url = base + "/v1/messages"
        headers = {"x-api-key": api_key, "anthropic-version": connection.get("api_version") or "2023-06-01"}
        system = next((message["content"] for message in messages if message["role"] == "system"), "")
        payload = {"model": connection["model"], "messages": [m for m in messages if m["role"] != "system"],
                   "system": system, "temperature": connection.get("temperature", 0.2),
                   "max_tokens": connection.get("max_tokens", 1200)}
    else:
        raise ConfigurationError("Mock provider does not make HTTP requests")
    try:
        async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.is_error:
            _log_upstream_error(provider, response.status_code, response.text)
            raise RuntimeError(f"provider returned HTTP {response.status_code}: {response.text[:300]}")
        data = response.json()
        if provider == "anthropic":
            return "".join(part.get("text", "") for part in data.get("content", []))
        return data["choices"][0]["message"]["content"]
    except httpx.HTTPError as exc:
        logger.error("LLM upstream request failed", extra={"fields": {
            "provider": provider, "error_type": type(exc).__name__,
        }})
        raise RuntimeError(f"provider request failed: {type(exc).__name__}") from exc


async def stream_complete(connection: dict, api_key: str, messages: list[dict], timeout: int,
                          transport: httpx.AsyncBaseTransport | None = None):
    if connection["provider"] != "openai" or not is_keyless_ollama(connection):
        raise ConfigurationError("Streaming is only supported for local Ollama")
    base = connection.get("base_url", "").rstrip("/")
    if not api_key and not is_keyless_ollama(connection):
        raise ConfigurationError("An API key is required for this OpenAI-compatible endpoint")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    payload = {"model": connection["model"], "messages": messages,
               "temperature": connection.get("temperature", 0.2),
               "max_tokens": connection.get("max_tokens", 1200), "stream": True}

    def parse_event(data: str) -> tuple[str | None, bool]:
        data = data.strip()
        if data == "[DONE]":
            return None, True
        try:
            value = httpx.Response(200, text=data).json()
        except ValueError as exc:
            raise RuntimeError("provider returned an invalid stream event") from exc
        if not isinstance(value, dict) or value.get("error"):
            raise RuntimeError("provider returned a stream error")
        choices = value.get("choices")
        if not isinstance(choices, list):
            raise RuntimeError("provider returned an invalid stream event")
        if not choices:
            return None, False
        delta = choices[0].get("delta", {})
        content = delta.get("content") if isinstance(delta, dict) else None
        if content is not None and not isinstance(content, str):
            raise RuntimeError("provider returned an invalid stream event")
        return content, False

    try:
        async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
            async with client.stream("POST", base + "/chat/completions", headers=headers, json=payload) as response:
                if response.is_error:
                    response_parts = []
                    response_length = 0
                    async for part in response.aiter_text():
                        response_parts.append(part[:4096 - response_length])
                        response_length += len(response_parts[-1])
                        if response_length >= 4096:
                            break
                    _log_upstream_error(connection["provider"], response.status_code, "".join(response_parts))
                    raise RuntimeError(f"provider returned HTTP {response.status_code}")
                response.raise_for_status()
                data_lines = []
                saw_done = False
                async for line in response.aiter_lines():
                    if not line:
                        if data_lines:
                            content, finished = parse_event("\n".join(data_lines))
                            data_lines.clear()
                            if content:
                                yield content
                            if finished:
                                saw_done = True
                                break
                        continue
                    if line.startswith(":"):
                        continue
                    if line.startswith("data:"):
                        data_lines.append(line[5:].lstrip())
                if not saw_done and data_lines:
                    content, finished = parse_event("\n".join(data_lines))
                    if content:
                        yield content
                    saw_done = finished
                if not saw_done:
                    raise RuntimeError("provider stream ended before completion")
    except httpx.HTTPError as exc:
        logger.error("LLM upstream stream request failed", extra={"fields": {
            "provider": connection["provider"], "error_type": type(exc).__name__,
        }})
        raise RuntimeError(f"provider stream failed: {type(exc).__name__}") from exc
