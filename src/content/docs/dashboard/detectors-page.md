---
title: Detectors page
description: See which detectors are loaded and which models back them.
---

The Detectors page (`/detectors`) is split into two sections: the detector adapters currently registered with the gateway, and the ML models held in memory that back the model-driven detectors.

## What you see

### Detectors section

Backed by `GET /manage/detectors`. Each row:

| Column | Meaning |
|---|---|
| **Name** | The detector adapter identifier (e.g. `regex`, `yara`, `pii_scanner`, `prompt_injection_ml`) |
| **Status** | `active` (loaded, ready to evaluate), `degraded` (loaded but reporting errors), or `disabled` |
| **Backing model** | For ML-driven detectors, the model name; otherwise `—` |
| **Last evaluation** | Time and outcome of the most recent call |
| **Evaluations / s** | Recent throughput |

Click a row to see the detector's configuration: which rule files it loaded, which model it points at, its score-emission semantics (per-message vs. per-content), and any per-detector overrides.

### Models section

Backed by `GET /manage/models`. ML models are loaded into memory at startup or on demand.

| Column | Meaning |
|---|---|
| **Name** | Model identifier — typically `<task>-<version>` (e.g. `prompt-injection-v3`) |
| **Task** | What the model classifies (e.g. `prompt_injection`, `jailbreak`) |
| **Memory** | Approximate resident memory in MB |
| **Loaded at** | When the model entered memory |
| **Status** | `loaded`, `loading`, or `unloaded` |

## What you can do

- **Reload a detector** — re-reads its rule files (for rule-based detectors) or re-initialises (for ML detectors) without restarting the gateway.
- **Disable a detector** — removes it from the evaluation pipeline. Pre-existing policies that reference it still validate, but score contributions from this detector will be zero.
- **Unload a model** — frees memory; the next request that needs it will reload on demand.

## When the Detectors section is empty

If the detectors table is empty but the gateway is otherwise healthy, the management API endpoint may not be wired into your build. Check that the gateway was built with the `dashboard` feature flag and that the `--dev-mode` flag was passed (or a valid admin API key supplied). See [Installation](../getting-started/installation.md).

## Related pages

- [Concepts → Detectors](../concepts/detectors.md) — the detector taxonomy in detail.
- [Rules page](rules-page.md) — rules are evaluated by detectors. Rule-based detectors will only fire for rules that are enabled there.
- [Reference → Detection categories](../reference/detection-categories.md) — which categories each detector emits.
