---
title: API Gateway 401 and 403 Errors
category: API Management
tags: api gateway, kong, 401, 403, oauth2, token, jwt, subscription, client id
---
# API Gateway 401 and 403 Errors

Use this guide for approved Kong routes that use OAuth2 client credentials.

## 401 Unauthorized vs 403 Forbidden
- A 401 means the request did not present a valid credential or access token.
- A 403 means the identity was recognized but the route or requested action is not permitted.
- Check the gateway request ID and environment before changing scopes or subscriptions.

## Diagnose a 401
1. Confirm the request sends `Authorization: Bearer ACCESS_TOKEN` with one space after Bearer.
2. Decode token claims locally without sharing the token; inspect `exp`, `aud`, and `iss`.
3. JWT expiry is typically one hour; obtain a fresh token when `exp` has passed.
4. Verify audience and issuer match the target environment exactly.
5. Refresh the token when 80% of `expires_in` has elapsed for long-running clients.

## Diagnose a 403
1. Confirm the client has an approved subscription for the API product and environment.
2. Verify the token includes the scopes required by the route.
3. Check whether the source IP is permitted by the API's IP restriction policy.
4. Do not request broader scopes as a workaround for a missing subscription approval.

## Common mistakes
1. Using a sandbox token against a production audience or issuer.
2. Sending the client ID instead of the access token in the Authorization header.
3. Copying an expired token from a terminal history or old environment file.
4. Omitting the subscription approval even though OAuth authentication succeeded.

## Test with curl
1. Obtain a token using the approved OAuth2 client-credentials flow and protected secret store.
2. Call the documented route with `curl -i -H "Authorization: Bearer $TOKEN" URL`.
3. Capture the HTTP status and `X-Request-ID` response header.
4. Never put a real token in a shared script, screenshot, shell transcript, or support ticket.

## When to escalate
Contact API Management with route, environment, timestamp, status, client ID, and request ID.
For 403, include approved subscription and scope names, not token contents.
For 401, include sanitized claim names and expiry time; never send the bearer token itself.
