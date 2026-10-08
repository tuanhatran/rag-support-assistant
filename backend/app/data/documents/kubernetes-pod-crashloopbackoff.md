---
title: Kubernetes Pod in CrashLoopBackOff
category: Platform Engineering
tags: kubernetes, k8s, pod, crashloopbackoff, oomkilled, eks, deployment, kubectl
---
# Kubernetes Pod in CrashLoopBackOff

Use this runbook for authorized on-call engineers troubleshooting a workload.

## Symptoms
- A pod repeatedly restarts and its status becomes CrashLoopBackOff.
- Events report OOMKilled, failed probes, or an application startup error.
- ImagePullBackOff appears before the container has started.

## Diagnose
1. Confirm the namespace, deployment, cluster, and recent rollout timestamp.
2. Run `kubectl describe pod POD -n NAMESPACE` and read Events and container state.
3. Run `kubectl logs POD -n NAMESPACE --previous` to inspect the last terminated container.
4. Record restart count, exit code, resource limits, and probe configuration.
5. ImagePullBackOff is an image or registry-pull problem, not a CrashLoopBackOff diagnosis.

## Fix: OOMKilled (exit code 137)
1. Confirm the previous state says OOMKilled and compare memory usage with the container limit.
2. Check for a memory leak, unexpectedly large input, or increased replica workload.
3. For Java containers, verify heap sizing such as `-XX:MaxRAMPercentage=75.0` respects the pod limit.
4. Raise the memory request and limit only after reviewing node capacity and service objectives.
5. Roll out the change gradually and monitor restart count and memory working set.

## Fix: application error at startup
1. Read previous logs and identify the first application error, not just the final exit line.
2. Compare ConfigMaps, environment variables, and image tag with the last healthy rollout.
3. Verify required sealed secrets exist in the correct cluster; secrets are cluster-scoped.
4. Roll back only through the approved deployment pipeline after impact assessment.

## Fix: liveness probe kills the container
1. Compare startup duration with initial delay, timeout, and failure threshold.
2. Add or tune a `startupProbe` for applications with slow initialization.
3. Keep readiness checks separate so an unready pod stops receiving traffic without restarting.
4. Validate probes against the application health endpoint and deploy to a small canary first.

## Fix: image problems
1. Verify the tag exists in the approved registry and the workload uses the expected architecture.
2. Check pull credentials and namespace imagePullSecrets without printing secret contents.
3. Treat ImagePullBackOff separately; no application process has started yet.

## When to escalate
Page Platform Engineering for production impact or repeated restarts after rollback.
Attach sanitized describe output, previous logs, rollout revision, exit code, and resource graphs.
Never paste secret values, full environment dumps, or customer payloads into a ticket.
