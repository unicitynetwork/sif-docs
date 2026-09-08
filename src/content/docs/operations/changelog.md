---
title: Changelog
description: Release notes and version history.
---

Each release entry documents what changed, with attention to anything an operator needs to do. Releases follow [Semantic Versioning](https://semver.org/) post-1.0.

> Pre-1.0 releases may include backwards-incompatible changes. They are called out at the top of the entry.

## Unreleased

Items in flight that have not yet shipped.

**Added — endpoint revocation and the enrolment-token lifecycle.**

`POST /manage/endpoints/{id}/revoke` permanently refuses an endpoint's
credential while preserving its history and evidence. The
`/manage/enrolment-tokens` API now supports listing token metadata with `GET`
and cancelling an unused token with `DELETE /{id}`. Token secrets are never
returned by the listing API, and a used token cannot be cancelled. These
operations require `endpoint:manage` and are audit-logged.

**Removed — `POST /manage/endpoints/tokens`.**
Read this before upgrading: a caller using it gets a 404.

Mint enrolment tokens at `POST /manage/enrolment-tokens` instead. The request
and response format are unchanged.

**Changed — rules and policies are now published as one atomic generation.**

A reload used to swap the compiled rules and the resolved policies separately.
A request landing between the two saw a mismatched pair: new policies selecting
rules that had not arrived, or the reverse. Both halves are now swapped
together, and a request pins the pair it started with, so a reload can no
longer happen underneath one.

Nothing to do on upgrade. The visible difference is that a request in flight
during a reload now completes against the generation it began with.

**Changed — one tenant's broken rules no longer stall every tenant's reload.**

A tenant slice that fails to compile used to be able to hold up the swap. Now
the swap proceeds for everyone else, and the failing tenant keeps the slice it
had (`Stale`) or falls back to the shared baseline (`BaselineFallback`) —
never a neighbour's rules. The status is per tenant and is surfaced on that
tenant's ruleset rows.

The baseline is still all-or-nothing: if it fails to compile, the whole swap is
abandoned and the previous generation keeps serving. Stale beats empty.

**Changed — the endpoint inventory API is now paginated.**
Read this before upgrading: `GET /manage/endpoints` now returns a
`{ data, page }` envelope rather than a bare array.

The endpoint list supports bounded pagination, filtering, and stable sorting.
Use `GET /manage/endpoints/{id}` to retrieve one endpoint directly. Existing
callers of the list route must read endpoint records from the `data` field.

**Changed — the `409` for a duplicate policy names the ID, not the name.**

Creating a policy whose `policy_id` is taken returned `policy '<x>' already
exists`. Read against a console that hides archived rows, that looked like a
lie, and it pointed at the wrong field: `policy_id` is unique, `name` is not.
Operators concluded the *name* was spent and gave up, when the way through was
to keep the name and change the ID — one field above the button they had just
pressed.

The message now names the field, says the holder may be an archived row, and
gives both ways out: a different `policy_id`, or
`POST /manage/policies/{id}/restore` if it is the same policy coming back. The
status code and the `error` value are unchanged, so nothing that keys on those
breaks; only the `message` text differs.

**Changed — the console distinguishes archiving from deleting, and can filter
the policy list.**

The policy list has **Active** / **Archived** / **All** filters with counts and
a search box; Active is the default, and its empty state says how many archived
policies it is hiding. The `⋯` menu offers **Archive policy…** for a policy
that has ever been published and **Delete policy…** for one that has not, and
both confirmations ask for the **Policy ID** rather than the name. An archived
policy offers **Restore policy** instead of a second delete.

**Removed — `POST /manage/rulesets/{id}/clone`.**
Read this before upgrading: a caller using it gets a 404.

Copying a ruleset is done on the **New ruleset** page now, and it defaults to
the safe behaviour the route did not have: the new ruleset points at the SAME
rules, so their patterns go on receiving the fixes we ship. A checkbox on that
form makes its own copies instead, and says what that costs — a copy of a
built-in rule stops receiving those fixes permanently.

The route made copies unconditionally and offered no way to say otherwise. It
also required the **platform role** for a built-in source, because
`disable_source` retired a pack for every tenant; the new path needs only
`rules:author`, so an ordinary operator can finally get editable copies of
built-in rules. `disable_source` itself has no replacement and needs none:
"Disable the ruleset" already exists on the same screen. Take the copy, then
turn the original off.

**Changed — a rules directory with no database is now a startup error.**
Read this before upgrading: a deployment running file-only will not start.

The packs under `rules/` are how default rules are shipped INTO a database, and
policies select rules from that database. Rules compiled without one therefore
belong to no policy's selection: every match they found was found and then
discarded, and the request returned 200 having screened nothing. Configure a
database, or remove `rules.directory` to run without rule matching at all and
know that you have.

**Changed — pack edits reach the database at boot, not on the reload tick.**

Composition reads the database now; the rules directory is read once at startup
to conform it. A pattern fix edited in a YAML file therefore needs a restart,
where it used to hot-apply on the reload interval.

What you get for it: the fix now actually arrives. The mirror only ever INSERTed
ids it had not seen, so a shipped pattern fix never reached a database that
already held the rule — one deployment was found running a rule with four
patterns whose file carried six, and refusing to compose at all as a result.
The mirror now updates changed rules, retires ones dropped from a pack, and
retires a pack whose file is gone — unless a policy still attaches it, in which
case nothing is touched and a warning names it.

**Changed — a policy naming one detector in two stages is now refused.**
Read this before upgrading: plans that published yesterday can fail today.

`Policy::validate` rejects an execution plan whose `stages` name the same
detector more than once. Because it sits in `validate`, every authoring path is
closed at once: explicit publish, create and update under
`policies.auto_publish` (default `true`), and the YAML loader — a policy file
carrying a duplicate now **fails policy load at startup** rather than loading
and misbehaving.

Why it is worth breaking: a duplicated detector ran twice on the same
preprocessed input for the same answer, and the combiner's weighted average
counted that answer in both the weighted sum and the total weight — so the
detector carried twice the say of every other one in the plan. It is not
fail-safe in either direction. A duplicated *permissive* detector dragged the
score down exactly as hard as a strict one pushed it up, so a policy could be
quietly more permissive than its author believed.

*What to do:* remove the repeat. The rules and thresholds you want are already
expressed by the single occurrence; a second one adds latency and a weighting
nobody chose. The console's policy screen marks the offending detector and
names the stages holding it before you save.

*What is deliberately not blocked:* a **mode-only** change. `update_policy`
validates only when the patch touches content, so turning a policy to
`monitor` or `off` still works on a policy carrying a duplicate. Turning
enforcement down must never be blocked by a defect in the thing being turned
down.

**Changed — the flatten merges a rule with the variants that tighten it.**
A tightening rule used to be a second row reusing the id it tightened; it is now
a *variant*, with its own id and a pointer to the rule whose pattern it borrows.
`GET /manage/policies/{id}/flattened` and the guard's own loader both merge on
that lineage, so attaching a pack and a ruleset that tightens it gives one rule
at the strictest setting rather than two rules firing on the same text. The
merged rule is reported under the tightened rule's id, and the variant's ruleset
appears in `tightened_by`.

The `shadowed_by` field, added earlier in this unreleased cycle, is **removed**.
It reported one id holding two different patterns with one silently discarded,
and the schema no longer permits that state: a rule defines a pattern or
inherits one, never both.

**Added — `publishable_detector_ids` on `GET /manage/detectors`.**
The full set of detector ids a policy stage may name: the live pipeline's
registry plus the binary's canonical set, which is what the publish gate
actually checks against. The existing `detectors` array is a narrower thing —
the non-ML pattern detectors *this process* registered — and a client reading
it as the authority concludes that `prompt_injection_ml` is unknown, which is
wrong on every shipped policy. Use `publishable_detector_ids` to validate;
`detectors` remains what it always was.

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
