---
title: Architecture overview
description: One diagram, three things to remember.
---

Unicity SIF Gateway is optimised to be memory efficient. Below are some key concepts to understand:

1. Gateway **deployment mode** — determines how policy enforcement is aplied
2. The **request lifecycle** — how a single prompt flows through.
3. The **detector taxonomy** — what kinds of checks run.
4. The **policy boundary** — where the block / flag / allow decision happens.

## Deployment mode

SIF Gateway will be deployable in two modes, as an API request proxy, and as an Inline proxy:

- SIF Gateway is deployed by default as an API callable proxy that returns a classification (and optionally may redact content). In this mode the API client decides how to enforce policy.
- SIF Gateway may be deployed as an inline proxy, in which case policy enforcement is handled within the gateway.

Note that Inline mode is not available in the MvP and is a roadmap item. Note also that load balancing is not supported in the MvP but will be fullly supported at GA.

## Request lifecycle

```
   Client (your app, Python SDK, curl)
       │  POST /api/v1/guard
       │  Authorization: Bearer <api_key>
       ▼
   Unicity-AOS9 gateway
       │  1. Validate API key → resolve policy
       │  2. Run the detector pipeline against the prompt:
       │       - regex rules (cheap)
       │       - YARA rules (string/binary matchers)
       │       - PII / DLP scanner
       │       - ML classifier (opt-in via feature flag)
       │  3. Combine detector scores → overall risk score
       │  4. Apply the policy:
       │       - score ≥ block_threshold → verdict = "block"
       │       - score ≥ flag_threshold  → verdict = "flag"
       │       - otherwise               → verdict = "allow"
       │  5. Persist the verdict + matched rules to Postgres
       │  6. Emit a WebSocket event on /ws/events
       ▼
   JSON verdict back to the client
```

For applications that also send the model response back through the gateway, the same pipeline runs against the response with response-side rule sets.

## Detector taxonomy

| Family | What it catches | Typical latency |
|---|---|---|
| **Regex** | Specific known-bad strings, simple patterns | sub-millisecond |
| **YARA** | Pattern combinations with logical operators | low-millisecond |
| **PII / DLP** | Identifiers (SSN, credit cards), credentials, emails | low-millisecond |
| **ML classifier** (opt-in) | Prompt-injection and jailbreak families | 5–15 ms |
| **Custom** | Anything written against the detector interface | depends |

Each detector emits a score in `[0, 1]` and optional metadata (matched rule, span, evidence). Scores are combined per the policy's aggregation mode — typically max, weighted-sum, or short-circuit on the first block.

## Policy boundary

- A **policy** is a named bundle: `block_threshold`, `flag_threshold`, `fail_mode` (what to do if a detector errors), aggregation mode, and which detector families are enabled.
- An **API key** is bound to exactly one policy.
- Multiple keys can share a policy. Changing a policy affects every key bound to it immediately — no restart.

That is the entire decision surface. The rest is configuration.

## Components on the wire

| Component | Role |
|---|---|
| Gateway (Rust) | All request handling, detection, policy evaluation |
| Postgres | Verdicts, threats, rules, policies, API keys, audit log |
| Redis | Rate-limit counters and ephemeral session state |
| Dashboard | Web UI for threat review, rule and policy management, key admin |
| Python SDK | Thin wrapper around `POST /api/v1/guard` for applications |

The gateway is stateless beyond its connections to Postgres and Redis. Scale by running multiple gateway processes behind a load balancer; no sticky sessions required.

## Where to go next

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — the same picture, with more detail per step.
- [Concepts → Detectors](../concepts/detectors.md) — what each detector kind actually does.
- [Concepts → Policies](../concepts/policies.md) — how the verdict is decided.
