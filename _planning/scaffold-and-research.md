# SIF User Guide — Research & Proposed Scaffold

> Status: proposal, awaiting approval before file creation.
> Target: a markdown content tree under `/Users/jamie/Work/unicity/sif-user-guide/`
> that will later compile into a Docusaurus (or similar) site.

---

## Part 1 — What a user guide for software like SIF should include

### What SIF is (from the code)

SIF is an LLM security gateway: a Rust service that intercepts prompts (and
optionally completions), runs them through a stack of detectors (prompt
injection, jailbreak, PII/DLP, YARA-style rules, ML classifiers), and returns
a verdict (allow / flag / block) per a configurable policy. It ships with a
web dashboard for threat review, rule and policy management, and API-key
admin. Postgres + Redis are the persistence and ephemeral state stores. A
Python SDK and REST API are the two integration paths.

### Audiences (drive section design)

| Audience | They want to | Their entry point |
|---|---|---|
| **App developers** | Add SIF to an LLM app's request path | Quickstart → SDK / API ref |
| **Security teams** | Write & tune detection rules and policies | Concepts → Rules → Policies → Dashboard |
| **Operators / SRE** | Deploy, scale, monitor | Installation → Deployment → Operations |
| **Threat analysts** | Use the dashboard day to day | Dashboard tour |

### Reference framework — Diátaxis (the industry standard)

Four orthogonal modes, never mixed in one page:

- **Tutorials** — learning by doing. *Getting Started*, *Quickstart*.
- **How-to guides** — solving specific problems. Recipe-style, action-oriented.
- **Reference** — looking things up. Configuration, API, schemas, error codes.
- **Explanation** — understanding why. Concepts, architecture, mental model.

Diátaxis is what the most-praised dev docs (Stripe, Django, Cloudflare,
Vercel, Lakera, GitLab) all converge on, with minor naming differences.

### What category-specific patterns add on top

From a sweep of comparable security-gateway / LLM-guardrail docs (Lakera
Guard, NeMo Guardrails, GuardrailsAI, Cloudflare AI Gateway, Auth0,
Cloudflare WAF):

- **A 10–15 min Quickstart that ends in a real `curl` returning a real
  verdict.** Engagement drops sharply if step 5 doesn't return JSON.
- **A single mental-model page** (one diagram, one page) that's linked from
  every other page. For SIF: *request → detectors → policy → verdict*.
- **Per-page dashboard tour** for visual products. Each route gets a page
  with screenshot + what-it-does + what-each-button-does.
- **Recipe library** beats reference for SDK integration. "How do I block
  PII in user prompts?" outperforms "Here's `client.guard()`".
- **Production checklist** — short, opinionated, late-stage. Auth, secrets,
  TLS, backups, monitoring, rate limits, fail-mode.
- **Error code reference** — one entry per error code with cause + fix.
  Single biggest preventer of support tickets.
- **Versioning + upgrade page** — even pre-1.0, customers need to know how
  upgrades will work.
- **Authentication page lives at the top** — not buried in reference.

### What to *not* do (common docs anti-patterns)

- Don't mix "what" and "why" on the same page (breaks Diátaxis).
- Don't write tutorials in the imperative without explaining context first.
- Don't put feature flags / known-limitations only in changelogs.
- Don't make the dashboard tour a single mega-page.
- Don't use "we" voice — keep it impersonal and product-focused.
- Don't expose internal codenames or refactor history in public docs.

---

## Part 2 — Proposed folder structure

```
sif-user-guide/
├── README.md                              # repo readme — how to build the docs
├── _planning/
│   └── scaffold-and-research.md           # ← this file
│
└── docs/                                  # framework-agnostic markdown
    │
    ├── index.md                           # landing — what is SIF, who it's for
    │
    ├── getting-started/
    │   ├── what-is-sif.md                 # product positioning + use cases
    │   ├── installation.md                # prerequisites, source build, Docker
    │   ├── quickstart.md                  # 10-min end-to-end, ends in a guard call
    │   └── architecture-overview.md       # one-diagram mental model
    │
    ├── concepts/
    │   ├── the-guard-pipeline.md          # request → detectors → policy → verdict
    │   ├── detectors.md                   # what each detector kind does
    │   ├── rules.md                       # rule format, built-in vs custom
    │   ├── policies.md                    # block/flag/allow thresholds, modes
    │   ├── api-keys-and-tenancy.md        # auth model, per-key policies
    │   └── threats-and-verdicts.md        # what gets logged, what doesn't
    │
    ├── dashboard/
    │   ├── index.md                       # dashboard tour landing
    │   ├── overview-page.md               # `/` — KPIs, recent activity
    │   ├── threats-page.md                # `/threats`
    │   ├── rules-page.md                  # `/rules`
    │   ├── policies-page.md               # `/policies`
    │   ├── detectors-page.md              # `/detectors`
    │   └── settings-page.md               # `/settings` — API keys
    │
    ├── api/
    │   ├── authentication.md              # API-key model, headers
    │   ├── guard-endpoint.md              # POST /api/v1/guard — the main one
    │   ├── batch-guard.md                 # batch variant
    │   ├── management-endpoints.md        # /manage/rules, /policies, /detectors
    │   ├── events-websocket.md            # /ws/events
    │   └── health-and-status.md           # /healthz, /readyz, /version, /status
    │
    ├── sdks/
    │   ├── index.md                       # which SDK to pick
    │   ├── python.md                      # promptshield (PyO3) — install + usage
    │   └── rest-via-curl.md               # no-SDK path
    │
    ├── guides/                            # how-to recipes
    │   ├── integrate-with-an-llm-app.md
    │   ├── write-a-custom-yara-rule.md
    │   ├── tune-a-policy-threshold.md
    │   ├── add-and-rotate-api-keys.md
    │   ├── handle-blocked-requests.md
    │   ├── stream-detection-events.md
    │   └── monitor-production-traffic.md
    │
    ├── deployment/
    │   ├── index.md                       # deployment options at a glance
    │   ├── docker-compose.md              # the official compose stack
    │   ├── kubernetes.md                  # helm chart / manifests (when ready)
    │   ├── postgres-and-redis.md          # managed vs self-hosted notes
    │   ├── tls-and-reverse-proxy.md
    │   ├── observability.md               # metrics, logs, traces
    │   └── production-checklist.md
    │
    ├── operations/
    │   ├── auth-and-secrets.md
    │   ├── backups-and-restore.md
    │   ├── upgrades-and-migrations.md
    │   ├── troubleshooting.md
    │   └── changelog.md
    │
    └── reference/
        ├── config-toml.md                 # every key in config.toml
        ├── environment-variables.md
        ├── detection-categories.md        # the taxonomy
        ├── verdict-shapes.md              # response JSON shapes
        ├── api-error-codes.md             # error → cause → fix
        └── compatibility-matrix.md        # supported Postgres / Redis / OS
```

### Why this shape

- **Top-level dirs map to Diátaxis modes** plus three product-specific zones
  (`dashboard/`, `api/`, `sdks/`) where the audience reads them as a unit.
- **`getting-started/` is sequential**, the rest is dip-in browsing.
- **`dashboard/` is per-page** so each route's doc is independently
  findable and screenshot-friendly.
- **`guides/` is the growing folder** — every "how do I…?" question that
  hits support becomes a new file here.
- **`reference/` is the dry one** — pure lookup, no narrative.

### What goes in the `index.md` files

Each subdirectory's `index.md` is a 1-paragraph orientation + a table of the
pages in that directory with one-line descriptions. This is the pattern that
worked for the Quayside docs (separate project) and matches Docusaurus's
sidebar autogenerate behavior.

---

## Part 3 — What I'd do next (waiting for go-ahead)

1. Create `docs/` and all subdirectories empty.
2. Create every `index.md` and `*.md` listed above as a stub with:
   - Frontmatter (`title`, `description`)
   - A short "What this page will cover" placeholder
   - A "Status: not yet written" marker
3. Write the **landing** (`docs/index.md`), **what-is-sif**,
   **installation**, **quickstart**, and **architecture-overview** as
   real content — those are the load-bearing first-impression pages.
4. Leave the rest as stubs to be filled in iteratively, prioritized by the
   recipe-library principle (which guides do we actually get asked about).
5. Add a `README.md` at the repo root explaining how to view/build the docs
   (live-preview via `npx serve docs` for now; Docusaurus or Starlight
   wrapper added later).

### Open questions for you

- **Framework**: Docusaurus (React-based, more flexible, heavier), or
  something lighter like Starlight (Astro-based) or VitePress? My
  recommendation is to defer this choice until the markdown shape is
  validated — the content is portable across all three.
- **Naming**: the codebase uses "PromptShield" and the dashboard sidebar
  variously shows "SIF Gateway" and "Unicity AOS9 SIF". What name should
  appear in the public docs? Suggest picking one before writing the
  landing page.
- **Scope of "deployment"**: Docker Compose only, or also Kubernetes?
  Start with Docker Compose; mark Kubernetes as a stub if no Helm chart
  exists yet.
- **API stability marker**: should the docs flag endpoints as `stable`,
  `beta`, `experimental`? Useful pre-1.0.
