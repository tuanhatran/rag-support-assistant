---
title: Database Connection Timeouts
category: Platform Engineering
tags: database, mongodb, documentdb, postgresql, timeout, connection pool, network, tls
---
# Database Connection Timeouts

Use these steps for MongoDB, DocumentDB, PostgreSQL, and HikariCP clients.

## Symptoms
- The application reports MongoTimeoutException or a database connection timeout.
- New requests queue while existing connections remain busy.
- TLS, authentication, or slow-query errors appear alongside timeouts.

## Step 1: network reachability
1. Confirm the database hostname and port for the correct environment without exposing credentials.
2. From the application network, run `nc -zv HOST PORT` where the tool is approved.
3. Verify security groups, firewall rules, routing, and Kubernetes NetworkPolicy allow the source.
4. Compare the result from the same subnet or pod network as the failing application.

## Step 2: TLS errors
1. Check certificate dates and trust-store configuration before disabling TLS verification.
2. For Amazon RDS, install the current `global-bundle.pem` in the application trust store.
3. Confirm the endpoint hostname matches the certificate and the runtime has a current CA bundle.
4. Never work around a certificate failure by switching to plaintext on a shared network.

## Step 3: authentication
1. Confirm the secret reference points to the intended database user and environment.
2. Check secret rotation time and restart clients if they do not reload rotated secrets.
3. For DocumentDB, configure `retryWrites=false` when required by the compatible driver.
4. Do not print a URI or password while diagnosing; redact connection strings in logs.

## Step 4: connection pool exhaustion
1. Inspect active, idle, pending, and maximum connections in HikariCP or the driver pool.
2. Look for unclosed sessions, long transactions, or a request surge holding connections.
3. Compare pool size with database limits and total replicas before raising the maximum.
4. Use bounded acquisition timeouts and an application-level concurrency limit.

## Step 5: slow queries
1. Review query latency and database CPU, memory, and storage metrics for the same time window.
2. Use MongoDB `explain()` to identify an unexpected COLLSCAN and missing index.
3. Test a proposed index against realistic query volume before creating it in production.
4. Avoid logging query documents that may contain personal or confidential data.

## When to escalate
Page Platform Engineering for production impact or a persistent pool/network failure.
Provide sanitized endpoint name, time window, driver version, error class, pool metrics, and trace ID.
Do not attach credentials, full connection strings, or raw customer records.
