from __future__ import annotations

import httpx

from app.errors import ConfigurationError


SYSTEM_PROMPT = ("You are an IT troubleshooting support assistant. Answer ONLY from the supplied context. "
                 "Use concise Markdown steps and cite sources as [n]. If context lacks the answer, say so and suggest a ticket. "
                 "Never invent commands, settings, or URLs.")


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
        url = base + "/chat/completions"
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
            raise RuntimeError(f"provider returned HTTP {response.status_code}: {response.text[:300]}")
        data = response.json()
        if provider == "anthropic":
            return "".join(part.get("text", "") for part in data.get("content", []))
        return data["choices"][0]["message"]["content"]
    except httpx.HTTPError as exc:
        raise RuntimeError(f"provider request failed: {type(exc).__name__}") from exc
