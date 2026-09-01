---
title: Guardrails › Tester
description: Put a prompt through the guard and see the verdict, without writing a client.
sidebar:
  order: 11
---

Guardrails › Tester (`/guardrails/tester`) sends a prompt through the guard exactly
as an application would, and shows you the verdict. It is the fastest way to answer
"would this be blocked?" without standing up a client.

## What it needs

A **guard API key** — a data-plane credential, the same kind your application uses.
Your console session is not one: signing in gives you the management API, and the
guard is a separate surface.

Get one from [Fleet › Keys](fleet-keys.md); the row menu can hand a key straight to
this screen.

## Where the key is kept

In `sessionStorage`, never `localStorage`. That is deliberate:

- it does not outlive the browser tab
- the next person at a shared desk does not inherit it

**Forget key** clears it immediately.

## Running a test

Give it a prompt and pick a policy. Sample prompts are provided — a clean one and a
PII leak — so you can confirm the plumbing works before trusting a result about
your own text.

The response gives you the verdict, the detections behind it, and the **request id**.

## The request id is the useful part

Take that id to [Activity › Audit](activity-audit.md) and you have the full record
of the decision — every detection, the policy version in force, the latency. A test
is not a black box; it leaves the same trail a production call does.

## Testing a specific rule

[Rule detail](guardrails-rule-detail.md) can send you here with that rule in hand,
which is the loop for tuning: change the rule, test, read the verdict, adjust.

## Capabilities

The console gates reaching the screen; the guard independently authenticates the
key you supply. A key that is suspended, expired or revoked will be refused here
exactly as it would in production — which makes this a fair way to check a key's
state.

See also: [Handle blocked requests](../guides/handle-blocked-requests.md),
[Threats and verdicts](../concepts/threats-and-verdicts.md).
