---
title: Unicity-AOS9 Documentation
description: Self-hosted LLM security gateway — detection, policy, threat review.
---

Unicity-AOS9 is a self-hosted control plane for LLM-powered applications. It sits between your application and the LLM provider, runs every prompt (and optionally every response) through a configurable stack of detectors, applies a per-API-key policy, and records the result for review.

In one sentence: **a programmable security boundary for your AI agents**.

## Where to start

| You are... | Read |
|---|---|
| Trying it for the first time | [Quickstart](getting-started/quickstart.md) |
| Deciding whether it fits your shape | [What is Unicity-AOS9](getting-started/what-is-sif.md) and the [Architecture overview](getting-started/architecture-overview.md) |
| Building an integration | [HTTP API](api/) and [Python SDK](sdks/python.md) |
| Writing detection rules | [Concepts → Rules](concepts/rules.md) and [How-to → Write a custom YARA rule](guides/write-a-custom-yara-rule.md) |
| Tuning blocking behaviour | [Concepts → Policies](concepts/policies.md) and [How-to → Tune a policy threshold](guides/tune-a-policy-threshold.md) |
| Operating in production | [Deployment](deployment/) and [Operations](operations/) |

## Sections

- **[Getting started](getting-started/)** — install, quickstart, mental model
- **[Concepts](concepts/)** — what the moving parts are
- **[Dashboard](dashboard/)** — page-by-page tour of the operator UI
- **[HTTP API](api/)** — REST endpoints and WebSocket events
- **[SDKs](sdks/)** — Python and direct HTTP
- **[How-to guides](guides/)** — recipes for common tasks
- **[Deployment](deployment/)** — production deployment paths
- **[Operations](operations/)** — running it day to day
- **[Reference](reference/)** — configuration, error codes, schemas

## Status

Pre-1.0. HTTP API endpoints are marked **beta** where the response shape may change before release. See [Reference → Compatibility matrix](reference/compatibility-matrix.md) for supported runtimes.
