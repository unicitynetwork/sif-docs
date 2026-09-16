---
title: Guardrails › Test
description: Ask what a policy would do with a prompt, with no credential and no data-plane effects.
sidebar:
  order: 11
---

Guardrails › Test (`/guardrails/test`) runs a prompt through the guard's own
detector pipeline and policy compiler and shows you the verdict. It is the
fastest way to answer "would this be blocked?" while you are writing or fixing a
policy.

**It needs no API key.** The console session is enough: the management process
evaluates the policy in-process, against the policy version you pick. Nothing is
minted, copied or retained to use this screen.

## What you pick

Two selectors:

- **Policy** — the tenant default if there is one, otherwise the first published
  policy.
- **Version** — the version the guard is running, and the newest draft when one
  is ahead of it. Each choice is labelled with its mode: `Published v7 ·
  enforce` or `Draft v8 · monitor`.

Versions are immutable and the preview names the exact one it evaluated, so a
save or a publish landing while you are reading cannot change what you actually
tested. The truth strip above the editor says which case you are in: a published
version is what the guard is running; a draft is running nowhere yet.

## What it does not do

A preview is not traffic. It creates:

- no Activity event and no `guard_request` audit row
- no receipt
- no captured payload
- no API-key rate-limit consumption, and no key's `last_used_at` touched

The only record is a control-plane audit event, `guard.preview.executed`, which
names the version tested and the action it produced — never the prompt. A
preview's request id carries a `preview_` prefix so it is never mistaken for
production evidence.

Testing real traffic is [Fleet › Keys › Verify](fleet-keys.md); that screen
deliberately holds a real key and sends a real request.

## Running a test

Type one user-role message, or pick one of the four examples — Clean, Prompt
injection, Jailbreak, Sensitive data — and press **Run preview**. The verdict
gives you the action, the risk score, the latency, the exact policy version and
mode behind it, the detections with their rule provenance, and the redacted
content when the policy asked for one.

A draft that does not compile is refused rather than half-evaluated, with the
same named refusals a publish would give.

## Publishing the draft you just tested

When the tested version is the newest draft, **Publish draft** publishes exactly
that version — this is also how a rollback is expressed. It takes
`policy:write`; without it the button is disabled and names the capability.

## Capabilities

Reading the screen takes `policy:read`; running a preview takes `payload:read`,
because a verdict can carry sensitive spans. Without `payload:read` the screen
stays reachable and says which capability is missing, with no enabled run
action.

See also: [Guardrails › Policies](guardrails-policies.md),
[Guardrails › Rule detail](guardrails-rule-detail.md).
