---
title: Changelog
description: Release notes and version history.
---

Each release entry documents what changed, with attention to anything an operator needs to do. Releases follow [Semantic Versioning](https://semver.org/) post-1.0.

> Pre-1.0 releases may include backwards-incompatible changes. They are called out at the top of the entry.

## Unreleased

Items in flight that have not yet shipped.

**Changed — agent-class policy enforcement is on by default (migration 036).**
Read this before upgrading: it changes what the guard API refuses.

Until now `tenants.class_policy_enforcement` defaulted to `off`, and the two
class/caller refusals were built but dormant. Migration 036 moves the column
default to `block` and moves every tenant still sitting at `off` to `block`.
Two request shapes that were served before now return **HTTP 400**:

- **`PolicyIsClassLed`** — an API key bound to an agent class sent its own
  top-level `policy_id`. The class already picks the policy. *Fix:* remove
  `policy_id` from the request.
- **`PolicyRequired`** — an API key bound to no agent class sent no
  `policy_id`, so nothing can pick a policy. *Fix:* name a `policy_id` in the
  request, or open the fallback below.

Both apply to `POST /api/v1/guard` and `POST /api/v1/guard/batch`; a batch is
refused whole rather than per item. **Endpoint-bound credentials (enrolled
endpoints) are exempt from `PolicyRequired`** — they carry no agent class and
never can.

**Added — `tenants.caller_led_policy_fallback`** (boolean, default `false`).
The one escape hatch: with it on, a caller-led key that names no `policy_id`
resolves through the tenant's default policy instead of being refused. It does
**not** relax `PolicyIsClassLed`.

**036 also ends the key-tier feature.** This is the consequence most likely to
catch you out, because nothing about it mentions agent classes. A key with an
assigned tier (`api_keys.policy_id`), bound to no agent class, sending no
`policy_id`, is refused with `PolicyRequired` **before** the resolution ladder
consults its tier. The tier rung is reachable only while
`caller_led_policy_fallback` is on. `api_keys.policy_id` is dropped by a later
migration regardless, so this is the target state — it just arrives here, with
no deprecation window in front of it.

**If you rely on per-key tiers, act before applying 036.** Either turn the
fallback on for the affected tenants:

```sql
UPDATE tenants SET caller_led_policy_fallback = true WHERE tenant_id = '<tenant>';
```

or assign those keys to an agent class, which is where the tier's job goes
permanently. Doing neither means every such key starts getting a 400 as soon as
the gateway restarts.

**Rollback**, per tenant, no down-migration needed:

```sql
UPDATE tenants SET class_policy_enforcement = 'off' WHERE tenant_id = '<tenant>';
```

Or for every tenant, drop the `WHERE`. The dial is read once at startup, so
either takes effect on the next restart — or immediately via
`PUT /manage/registry/enforcement`, which writes through to the running
gateway. Setting `flag` instead of `off` serves exactly what `off` serves
while recording what `block` would have refused, which is the safer way to
measure the blast radius before committing.

**Changed — a policy set to `off` now contributes no rules.** This changes what
the guard screens, not just what it reports, and it is visible on upgrade.

Previously `off` suppressed only the *verdict*. A key resolving to several
policies still had every one of their rulesets merged into the compiled plan
and screened, including the off ones; only the final action ignored them. So a
caller could be blocked by a rule that lives solely in a policy the operator had
switched off — while that policy dutifully reported itself as off.

Now an off policy is filtered out before anything is compiled: it contributes no
ruleset to the merge, no decision band, and no `fail_mode`. Its rules are not
assembled at all. A set in which *every* policy is off screens against nothing
and allows — it does **not** fall through to the tenant default, because the
class chose those policies and chose to have them off.

**Who this affects.** Multi-policy (class-led) keys where at least one attached
policy is `off`. **Callers previously blocked only by an off policy's rules now
pass.** If any policy is `off` today and you were relying on its rules still
running, that reliance was accidental and it ends here — move those rules into
an active policy's rulesets, or set the policy to `monitor` (which screens and
records without blocking) rather than `off`. Single-policy keys and keys whose
policies are all active are unaffected.

This is a deliberate exception to "composition only ever tightens": that rule
governs how several *active* policies compose, and a policy the operator
switched off is not a participant. Merging its rules anyway was not tightening,
it was ignoring an instruction. See [Concepts → How the pieces
fit](../concepts/how-the-pieces-fit.md) for where `mode` sits on a policy.

**Known issue — a rule can be in the corpus and never fire, silently.** Not
introduced by this release; recorded here because nothing else told operators
about it.

Rule patterns are compiled from the rule **files**, while the rule ids a policy
may use come from the **`rules` table**. Boot-time sync keeps them in step. If
the sync leaves a file rule without a row, the engine matches that rule and the
policy's selection then discards the match: the request returns `200`, the
detection is absent, and nothing on the response says screening was reduced.
Two triggers, both produced by the boot sync itself — a tenant ruleset squatting
a shipped pack's id (the whole pack is skipped, logged at `error`), and a single
failed rule-row insert (that one rule is missing, logged at `warn`). Both are
named in the boot log and nowhere else.

**Known and unfixed by decision** — every candidate fix changes behaviour and
none has been chosen. See [Troubleshooting → A rule is in the corpus but never
fires](troubleshooting.md#a-rule-is-in-the-corpus-but-never-fires) for the log
lines to grep and what to do about each trigger.

- **Helm chart** for Kubernetes deployment ([Deployment → Kubernetes](../deployment/kubernetes.md)).
- **Role-based dashboard auth** so operators can have read-only vs. admin access.
- **Per-class virtual keys** — a finer-grained alternative to the current shared-key model.

## v0.4.x — current

> **Schema migrations:** automatic on startup, additive only.

Release-by-release notes for the current series live here. Each entry should describe:

- **Added** — new capability.
- **Changed** — behaviour change for existing functionality. Read carefully.
- **Fixed** — bug fixes. Usually no operator action required.
- **Deprecated** — features still present but slated for removal.
- **Removed** — features that are gone. Lists the version where they were deprecated.

Example shape:

```
### v0.4.1 — 2026-05-15

**Added**
- `policies.short_circuit_threshold` — early-exit cut during detection.
- `/manage/keys/{id}/rotate` endpoint — issues a new secret with 24 h overlap.

**Changed**
- Dashboard route `/models` renamed to `/detectors`. The management
  endpoint `/manage/models` continues to work; the new endpoint
  `/manage/detectors` returns a superset.

**Fixed**
- WebSocket reconnection no longer floods the server when the consumer
  is slow — now respects 1009-close backoff.
```

## v0.3.x and earlier

Older releases are archived in the project's Git tags and the release notes attached to each tag. The summary here lists only milestones.

## Versioning policy

Semantic versioning applies post-1.0:

- **Major** — breaking API changes. Pre-announced in the previous minor release.
- **Minor** — new features. Always backwards-compatible.
- **Patch** — bug fixes. Always backwards-compatible.

Pre-1.0, minor versions may include breaking changes — read the release notes.

## Schema versioning

Schema changes are migrations applied automatically on startup. Migration files are numbered (`0001_initial.sql`, `0002_add_detections_index.sql`, …). The schema version is independent of the gateway version — many gateway versions can share a schema version.

When a gateway version requires a newer schema, the migration runs on the first startup of that version. There is no separate version-bump step.

## Where to subscribe

- **GitHub releases** — the canonical announcement.
- **Email / RSS** — when the project provides one.
- **Dashboard banner** — when a deployed gateway detects a newer version is available (planned).

## Related

- [Upgrades and migrations](upgrades-and-migrations.md) — how to apply a release.
- [Production checklist](../deployment/production-checklist.md) — what to verify after upgrading.
