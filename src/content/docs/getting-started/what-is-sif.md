---
title: What is Semantic Firewall
description: Product positioning, primary use cases, and what it is not.
sidebar:
  order: 1
---

Semantic Firewall is an inline security gateway for LLM-powered applications. A single Rust service sits between your application and an LLM provider. Every prompt passes through it, is evaluated by a configurable detector pipeline, is matched against a per-API-key policy, and is either forwarded, flagged, or blocked.

## The problem it solves

LLM-based applications face a class of risks that traditional web security tools do not cover:

- **Prompt injection** — adversarial input that overrides the system prompt or hijacks tool use.
- **Jailbreaks** — role-play and indirect exploits that bypass the model's own safety policies.
- **Data leakage** — sensitive content (PII, credentials, internal documents) appearing in either user input or model output.
- **Policy drift** — detection rules and block thresholds that must change without redeploying applications.

These risks are not naturally handled by application code. Semantic Firewall makes them a property of the gateway, not the app.

## What it does

- **Detection** — runs a configurable mix of regex rules, YARA rules, ML classifiers, and PII / DLP scanners.
- **Verdicts** — combines detector outputs into a single per-request decision: `allow`, `flag`, or `block`.
- **Policy** — controls thresholds, aggregation, and fail-mode per API key. Hot-reloaded without restarts.
- **Observability** — a web dashboard and a WebSocket feed surface every detection in near-real-time, backed by a complete audit log in Postgres.
- **API-first** — REST endpoints for guard calls and management. A Python SDK for application integration. Direct HTTP works from any language.

## Who it's for

- **Engineering teams** shipping LLM-backed features who want a control point that does not live in application code.
- **Security teams** who need to author and tune detection rules and policies without an engineering loop.
- **Operators** running production LLM workloads who need an audit trail for every prompt and verdict.

## What it is not

- Not a model gateway or cost-optimiser — no LLM routing, no provider failover, no caching.
- Not a fine-tuning or training platform.
- Not a generic MLOps platform.

Semantic Firewall is narrowly focused on the security boundary between an application and an LLM provider.

## Where to go next

- [Architecture overview](architecture-overview.md) — the one-diagram mental model behind how requests flow.
- [Quickstart](quickstart.md) — install, send a guard call, see a verdict in the dashboard.
