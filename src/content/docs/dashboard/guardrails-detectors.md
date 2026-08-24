---
title: Guardrails › Detectors
description: Which detectors this build loaded, and which models back them.
sidebar:
  order: 10
---

Guardrails › Detectors (`/guardrails/detectors`) shows what the running binary
loaded. It is a **read-only** screen.

## Nothing is created here

Detectors are registered by the build, not by you. There is no create, no delete,
and no per-detector configuration on this screen, because the management API has no
such verb — the set is fixed by how the gateway was compiled.

Per-policy detector configuration lives in the policy editor. See
[Guardrails › Policies](guardrails-policies.md).

The screen says this itself rather than offering controls that would always fail.

## Runs on the endpoint

Pattern detectors, compiled into the artefact. They cost the request nothing extra
— no hop, no model load.

Each card gives the detector's id, a line on what it does, and its kind:

| Kind | What it is |
|---|---|
| `keyword` | Literal word lists. The cheapest check there is, and the first to run. |
| `regex_detector` | Standalone patterns outside the rulesets. Mostly secret shapes. |
| `yara` | YARA rules, for payload shapes a regex cannot describe. |

A card also says whether the detector is running at its default configuration or
has been overridden.

**There are no per-detector timings or signal counts.** That would need a
server-side aggregate which does not exist, so the screen shows nothing rather than
showing zero.

## Runs here

The ML models. Too heavy for the endpoint, so they cost the request a hop.

Each card gives the model name, the labels it classifies into, the base model it
was fine-tuned from where there is one, its size on disk, its status, and whether
it is currently loaded.

If the build has no ML pipeline, the section says so and names the fix:

```bash
cargo build --features ml
```

That is a statement about the build, not an empty table. A build without `ml` is a
valid deployment, not a broken one.

## If the pattern list is empty

An empty pattern list on an otherwise healthy gateway usually means the management
API is not wired into your build. Check the gateway was built with the `dashboard`
feature and that a valid admin credential is in play. See
[Installation](../getting-started/installation.md).

## Capabilities

Reading needs a session; there is nothing here to gate beyond that, because there
is nothing to change.

See also: [Detectors](../concepts/detectors.md),
[Detection categories](../reference/detection-categories.md),
[Guardrails › Rules](guardrails-rules.md) — rule-based detectors only fire for
rules that are in force there.
