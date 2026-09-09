---
title: How the pieces fit
description: Detectors, rules, rulesets and policies — what each one actually is, and the two paths a rule can take to a decision.
---

Four words do most of the work in SIF, and they are easy to confuse because
three of them sound like the same kind of thing. They are not.

> A **policy** chooses which **detectors** run. One of those detectors — the
> rule engine — runs the **rules** in the **rulesets** that policy attaches.
> Everything else follows from that sentence.

This page is the long version, written against the source rather than from
memory. Every claim names the file it came from.

## The one-paragraph version

A **detector** is a compiled program. A **rule** is data that one particular
detector reads. A **ruleset** is a file or database row holding rules.
A **policy** is configuration that decides which rulesets are in play, which
detectors run, in what order, and what their output is allowed to do.

They are three layers, not three siblings — which is worth holding onto,
because the dashboard lists them side by side as though they were peers.

---

## Detector — the machinery

A detector is Rust code implementing one trait
(`semd-engine/src/detector.rs`):

```rust
pub trait Detector: Send + Sync {
    fn id(&self) -> &str;
    fn detector_type(&self) -> &str;
    async fn detect(&self, input: &DetectorInput) -> EngineResult<DetectorOutput>;
    fn is_enabled(&self) -> bool { true }
    fn default_weight(&self) -> f64 { 1.0 }
}
```

That is why **you cannot create one from the dashboard, and there is no API
for it.** Creating a detector means writing a function and compiling it. There
is no row you could store that would become a working one — you would be
storing the name of a program that does not exist.

Six exist today, one file each in `semd-engine/src/detectors/`:

| Detector | What it is |
|---|---|
| `rule_engine` | A general engine that runs whatever rules it is given |
| `regex_detector` | Regex patterns supplied at construction |
| `keyword` | Literal word lists supplied at construction |
| `yara_detector` | YARA signatures (`rules/yara/*.yar`) |
| `dlp_scanner` | Data-loss patterns, plus an NER model when built with `ml` |
| `ml_classifier` | A trained classifier |

**Every detector returns confidence numbers, never a decision.** A
`DetectionSignal` carries a `confidence`; what that means is the policy's
business.

### Instances, and where they come from

`RegexDetector` takes its patterns as an argument — nothing is hardcoded into
the *type*:

```rust
pub fn new(id, patterns: Vec<RegexPattern>, config) -> EngineResult<Self>
```

But the shared runtime hands it a constant (`crates/semanticd/src/app.rs`):

```rust
RegexDetector::with_patterns("pii_regex", RegexPatternBuilder::pii_patterns())
```

So `pii_regex` and `secrets_regex` are two *instances* of the same generic
detector, created in `app.rs`. **The code is configurable; the wiring is
not.** Changing what `pii_regex` matches means editing `pii_patterns()` and
rebuilding. Nothing reads config, YAML or the database for them.

## Rule — the data

A rule is the only part of detection you can author. Its `match.type` decides
which detector runs it — most types go to `rule_engine`, a `yara` rule to the
YARA detector, an `ml_model` rule to the classifier it names. The format is
YAML (`rules/pii-detection.yaml`):

```yaml
rules:
  - id: pii-fin-001
    name: "Credit card number"
    category: pii
    severity: critical
    action: flag
    applies_to: [prompt, generated_code]
    match:
      type: regex
      patterns:
        - "\\b4[0-9]{3}[\\s-]?[0-9]{4}[\\s-]?[0-9]{4}[\\s-]?[0-9]{4}\\b"
      mode: any
    score: 0.95
```

`match.type` is one of five variants (`semd-rules/src/schema.rs:106`):

| Variant | Carries |
|---|---|
| `regex` | `patterns`, `mode`, `case_insensitive` |
| `keywords` | `keywords`, `mode`, `case_insensitive` |
| `composite` | nested `conditions` + `mode` |
| `transform_then_match` | `transforms`, then another match |
| `semantic_similarity` | an embedding comparison — **refused at authoring**: no evaluator exists in the engine |

So **"let a user type a regex or a keyword list and have it checked" is
already built.** It is a rule. If that is not discoverable in the console,
that is a UI problem, not a backend one.

### A rule carries an action

`Rule.action` is `Option<RuleAction>` — `Allow`, `Flag`, `Ask` or `Block`
(`semd-core/src/types/rule.rs`). The doc comment is emphatic that `None` is
**not** a licence to guess:

> `None` means the rule has not been classified yet. It is **not** a licence
> to guess: per the compiler's never-silently-drop rule, an unclassified rule
> must surface at author time and land in the artefact's `uncompiled` list.
> Deriving the action from `severity` or `score` is precisely the mistake this
> field exists to prevent.

`applies_to` behaves the same way: empty means unclassified, and there is
deliberately no default, because a rule fired against the wrong corpus fails
closed at the edge.

## Ruleset — where rules live

A ruleset is a named, versioned group of rules. Rulesets come from two places and
are merged on every reload:

- **Files** — `rules/*.yaml`, shipped with the gateway. `is_builtin: true`.
- **Database** — created through `POST /manage/rulesets`, then
  `/manage/rulesets/{ruleset_id}/rules`. This is where anything you author lands.

A built-in ruleset cannot be edited in place, because the file owns it. To change
a built-in rule's body you clone the ruleset — which copies its rules into an
editable one.

To tune a shipped rule *without* forking the pack, keep the built-in attached and
add a ruleset of your own carrying a rule with the same id and a stricter score
or severity. The strictest value wins, and the pattern still comes from the
shipped pack, so you keep receiving upstream improvements to it.

## Policy — the configuration

A policy owns no rules and no detectors. It holds
(`semd-core/src/types/policy.rs`):

| Field | Decides |
|---|---|
| `stages[].detectors` | which detectors run, and in what order |
| `stages[].decision` | thresholds for that stage |
| `detectors[id].weight` | how much that detector counts |
| `detectors[id].thresholds` | `{ flag, block }` — where a score becomes an action |
| `detectors[id].category_overrides` | thresholds per **rule category** |
| `fail_mode` | open or closed when a check breaks or times out |
| `global_timeout_ms` | total budget for all detectors |
| `short_circuit` | stop early once confident |
| `mode` | `off` / `monitor` / `enforce` |

Two consequences worth stating plainly:

**A policy names the rulesets it uses.** Not as a field on `Policy` — the link
is the `policy_rulesets` table
(`semd-db/src/migrations/120260828165613_policy_rulesets.sql`), an ordered list
of any number of rulesets per policy. Their rules are **flattened into one
effective list before anything runs** (`semd-rules/src/flatten.rs`), so a
ruleset is a folder for authoring and reuse, not a runtime unit: a rule in two
attached rulesets appears once and runs once. Where one id appears twice the
strictest value of each field wins — `enabled` `true`, the higher `score` and
`severity`, the stronger `action`, the union of `applies_to`, the *lower* ML
threshold. So attaching a ruleset can only ever tighten a policy, never loosen
it.

**`category_overrides` tunes by rule category, not by ruleset.** Because
every rule has a `category`, a policy can hold different thresholds for
different groups of rules inside the one engine, without any new detector.
The ruleset a rule came from survives the flatten only as provenance on the
verdict; it is not something a threshold can be hung on.

## The two paths a rule can take

This is the part that is easy to miss, and it explains the "runs on the
endpoint" / "runs here" split in the console.

### Path 1 — the edge artefact

`semd-rules/src/artefact.rs` compiles rules into a corpus for the edge. Here
the rule's **authored action wins**, adjusted only by the policy's rollout
mode (`degrade_for_mode`):

- `enforce` — the action applies as authored.
- `monitor` — `Block` and `Ask` become `Flag`. `Allow` and `Flag` are left
  alone, because degrading `Flag` to `Allow` would lose the record, which is
  the entire point of monitor.
- `off` — no rules are emitted at all.

### Path 2 — the central engine

Detectors run, each returning signals with confidences. Those are weighted
(`DetectionSignal::weighted_score`), aggregated
(`total_weighted_score`, `max_confidence`) and compared against the policy's
thresholds to produce the verdict.

So the same rule can reach a decision two different ways: deterministically at
the edge from its own action, or by score at the centre against the policy's
thresholds. **Both are correct; they are different deployments of the same
rule.**

## Hot reload — what actually happens

There is **no filesystem watcher.** Reload is driven two ways, both funnelling
through one writer so they cannot disagree:

1. **A timer.** `hot_reload_runtime` (`crates/semanticd/src/app.rs`) ticks every
   `rules.reload_interval_secs` — **30 seconds** in `config.demo.toml`.
2. **Redis pub/sub.** `redis_subscriber.rs` triggers the same path on a
   message, so with Redis configured the change is near-immediate.

Each pass calls `ManageState::reload_runtime_store`, which recomposes the rules
(`rules_compose::compose_and_store`) and then republishes the policies against
them. Composition:

- reads the file rulesets **and** the database,
- composes them per tenant,
- compiles,
- and swaps the whole store atomically (`replace_all`).

**Rules and policies are published as one generation, not two.** The compiled
rules and the resolved policies that select them are swapped together
(`PolicyStore::replace_all_with_rules`), and a request pins the pair it started
with (`RuntimeSnapshot`). So a request never sees new policies selecting rules
that have not landed yet, or old policies against a corpus that has already
moved — and a long request cannot observe a reload happening underneath it.

Three safety behaviours are deliberate and worth knowing:

- **A tenant whose rules fail to compile does not stop anyone else's reload.**
  The swap still happens for every other tenant. The failing tenant keeps the
  slice it had (status `Stale`), or, if it never had one, reads the shared
  baseline (status `BaselineFallback`) — never a neighbour's rules. Either way
  its rules read as saved and enabled while screening nothing new, which is
  exactly the silent failure the product exists to prevent, so the status is
  recorded per tenant and surfaced on the ruleset rows.
- **The baseline is the exception.** If the baseline itself fails to compile,
  the whole swap fails and the previous generation keeps serving — stale beats
  empty.
- **If the database is unreachable, the previous snapshot is kept** rather
  than reverting to files alone. The code comments note this replaced an
  earlier behaviour that silently discarded database customisation on every
  tick.

**Practically: save a rule in the console, and it is live within a tick. No
restart, no rebuild.**

## Known gaps and inconsistencies

These are things the source shows today, recorded so nobody rediscovers them.

### PII is shipped twice, by two different mechanisms

`rules/pii-detection.yaml` is a built-in ruleset of PII rules. `pii_regex` is a
hardcoded Rust pattern set covering email, US phone and SSN — also category
`pii`. Both are in the same binary.

The two records are near-identical in shape:

| `RegexPattern` | Rule |
|---|---|
| `name` | `id` / `name` |
| `pattern` | `match.patterns` |
| `category` | `category` |
| `confidence` | `score` |
| `description` | `description` |

A rule adds `severity`, `action`, `applies_to`, `enabled`, `tags` and the
richer match variants. So a hardcoded pattern set is, in effect, a ruleset
with fewer fields that took a different route into the binary — and the
system already has a first-class notion of built-in rulesets (`is_builtin`).

Expressing those two as built-in rulesets would give them versioning, per-rule
tightening through composition, hot reload and a console presence for free.
The one thing they would lose is their own seat at the policy table: today
`pii_regex` can hold its own weight and stage, and as rules they would inherit
the rule engine's.

### Edge classification in the management API

Rule create, update and read responses carry `action` and `applies_to` for the
edge path. Both may be omitted for a SIF-only rule. An edge-classified rule must
provide an action and at least one corpus; the API refuses a half-classified
rule instead of guessing either value. Dashboard editing controls are a
separate UI concern.

A variant may omit both fields and inherit its root's classification. If it
declares its own classification, the effective action is the stricter one and
the effective corpora are the union across the lineage. A variant therefore
cannot loosen the rule it derives from, including when its root is not attached
to the same policy.

### There is no detector registry

You cannot create a named detector instance at runtime. The plumbing is
closer than it sounds — `RegexDetector` already takes its patterns as an
argument, so no new trait or type would be needed; what is missing is
somewhere to store `(id, Vec<RegexPattern>)` and a boot path that reads it
instead of calling `pii_patterns()`.

Before building that, it is worth asking what it buys over a rule:

| | A rule | A detector instance |
|---|---|---|
| Content | your regex / keywords | your regex / keywords |
| Own score | per rule | per instance |
| Own weight in a policy | no — shares the rule engine's | yes |
| Own place in the pipeline | no — runs where the rule engine runs | yes — its own stage |

Rules give **content** granularity. Instances give **pipeline** granularity.
Rule categories plus `category_overrides` already cover a good deal of the
middle ground.

## Quick answers

**Can I add a regex from the console and have it work?** Yes — as a rule. Live
within a reload tick, no restart.

**Can I make a new detector?** No, and there is no API for it. A detector is
compiled code.

**Can I configure `pii_regex`?** Not at runtime. Its patterns are a hardcoded
constant. Write a rule instead.

**Does a rule decide anything on its own?** At the edge, yes — its authored
action applies, degraded by the policy's mode. At the centre, no — it emits a
score and the policy's thresholds decide.

**Which detectors run rules?** Three kinds. `rule_engine` runs the pattern
types (regex, keywords, composite, transforms, semantic similarity); the YARA
detector runs `yara` rules; and each `ml_model` rule goes to the classifier it
names. `regex_detector`, `keyword` and `dlp_scanner` carry their own content
instead — nothing you author reaches them.

**What decides which detectors run at all?** The rulesets the policy attaches.
A policy that attaches nothing runs nothing, and a policy whose rules never
name a model never loads one. `stages` then say in what ORDER the eligible
detectors run and where the cascade may stop early — they do not widen the
set.

## Related

- [Detectors](detectors.md)
- [Rules](rules.md)
- [Policies](policies.md)
- [The guard pipeline](the-guard-pipeline.md)
