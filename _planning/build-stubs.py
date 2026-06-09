"""Generate Unicity-AOS9 user-guide scaffold.

Creates section index pages (with orientation + page table) and per-page
stubs. Skips load-bearing pages that are written separately with real
content (root index, what-is-sif, installation, quickstart,
architecture-overview).

Safe to re-run — never overwrites existing files. To regenerate a stub or
index, delete the file first.
"""

from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "src" / "content" / "docs"

SECTION_TITLES = {
    "getting-started": "Getting started",
    "concepts": "Concepts",
    "dashboard": "Dashboard tour",
    "api": "HTTP API",
    "sdks": "SDKs",
    "guides": "How-to guides",
    "deployment": "Deployment",
    "operations": "Operations",
    "reference": "Reference",
}

SECTION_ORIENTATION = {
    "getting-started": (
        "Start here. Install Unicity-AOS9, send your first guard call, and "
        "learn the mental model behind what the gateway is doing."
    ),
    "concepts": (
        "What the moving parts are and how they relate. Read these pages "
        "before tuning policies or writing custom rules."
    ),
    "dashboard": (
        "A page-by-page tour of the operator UI. Each page below "
        "corresponds to a route in the dashboard."
    ),
    "api": (
        "The REST and WebSocket interface to Unicity-AOS9. Endpoints are "
        "marked **beta** where the shape may change before the 1.0 release."
    ),
    "sdks": (
        "Language bindings and integration paths. Pick the one that "
        "matches your application stack."
    ),
    "guides": (
        "Task-oriented recipes — each guide answers a single \"how do I…?\" "
        "question."
    ),
    "deployment": (
        "Going from a laptop install to a production deployment. Covers "
        "Docker, Kubernetes, Postgres, Redis, TLS, and observability."
    ),
    "operations": (
        "Running Unicity-AOS9 day to day — auth, backups, upgrades, "
        "troubleshooting."
    ),
    "reference": (
        "Lookup tables — config keys, environment variables, error codes, "
        "response shapes."
    ),
}

SECTIONS = {
    "getting-started": [
        ("what-is-sif", "What is Unicity-AOS9", "Product positioning and primary use cases"),
        ("installation", "Installation", "Prerequisites, source build, and Docker"),
        ("quickstart", "Quickstart", "10-minute end-to-end walkthrough"),
        ("architecture-overview", "Architecture overview", "One-diagram mental model"),
    ],
    "concepts": [
        ("the-guard-pipeline", "The guard pipeline", "Request → detectors → policy → verdict"),
        ("detectors", "Detectors", "Detection mechanisms and categories"),
        ("rules", "Rules", "Rule format, built-in vs custom, hot reload"),
        ("policies", "Policies", "Block / flag / allow thresholds and modes"),
        ("api-keys-and-tenancy", "API keys and tenancy", "Auth model and per-key policies"),
        ("threats-and-verdicts", "Threats and verdicts", "What gets logged and what doesn't"),
    ],
    "dashboard": [
        ("overview-page", "Overview page", "`/` — KPIs and recent activity"),
        ("threats-page", "Threats page", "`/threats` — detection events"),
        ("rules-page", "Rules page", "`/rules` — rule management"),
        ("policies-page", "Policies page", "`/policies` — policy management"),
        ("detectors-page", "Detectors page", "`/detectors` — detector status and config"),
        ("settings-page", "Settings page", "`/settings` — API keys and access control"),
    ],
    "api": [
        ("authentication", "Authentication", "API key headers and auth model"),
        ("guard-endpoint", "Guard endpoint (beta)", "`POST /api/v1/guard`"),
        ("batch-guard", "Batch guard (beta)", "Multiple prompts in one request"),
        ("management-endpoints", "Management endpoints (beta)", "`/manage/rules`, `/manage/policies`, `/manage/detectors`"),
        ("events-websocket", "Events WebSocket (beta)", "Streaming verdict and threat feed"),
        ("health-and-status", "Health and status", "`/healthz`, `/readyz`, `/version`, `/status`"),
    ],
    "sdks": [
        ("python", "Python SDK", "Python integration package"),
        ("rest-via-curl", "REST via curl", "No-SDK integration with curl or any HTTP client"),
    ],
    "guides": [
        ("integrate-with-an-llm-app", "Integrate with an LLM app", "Wire Unicity-AOS9 into your app's prompt path"),
        ("write-a-custom-yara-rule", "Write a custom YARA rule", "Add bespoke detection logic"),
        ("tune-a-policy-threshold", "Tune a policy threshold", "Adjust block / flag boundaries"),
        ("add-and-rotate-api-keys", "Add and rotate API keys", "Operational key lifecycle"),
        ("handle-blocked-requests", "Handle blocked requests in your app", "Graceful UX for verdicts"),
        ("stream-detection-events", "Stream detection events", "Consume the WebSocket feed"),
        ("monitor-production-traffic", "Monitor production traffic", "Dashboards, alerts, SLOs"),
    ],
    "deployment": [
        ("docker-compose", "Docker Compose", "The reference stack"),
        ("kubernetes", "Kubernetes", "Helm chart and manifests (stub — pending official manifests)"),
        ("postgres-and-redis", "Postgres and Redis", "Persistence and ephemeral state"),
        ("tls-and-reverse-proxy", "TLS and reverse proxy", "nginx, Caddy, or a load balancer in front"),
        ("observability", "Observability", "Metrics, logs, traces"),
        ("production-checklist", "Production checklist", "What to verify before going live"),
    ],
    "operations": [
        ("auth-and-secrets", "Auth and secrets", "Where credentials live and how to rotate"),
        ("backups-and-restore", "Backups and restore", "Postgres snapshot and recovery"),
        ("upgrades-and-migrations", "Upgrades and migrations", "Safe upgrade path"),
        ("troubleshooting", "Troubleshooting", "Common failure modes"),
        ("changelog", "Changelog", "Release notes and version history"),
    ],
    "reference": [
        ("config-toml", "config.toml", "Every key in the gateway configuration file"),
        ("environment-variables", "Environment variables", "Runtime overrides"),
        ("detection-categories", "Detection categories", "Taxonomy of what gets detected"),
        ("verdict-shapes", "Verdict shapes", "Response JSON shapes"),
        ("api-error-codes", "API error codes", "Cause and fix for every error"),
        ("compatibility-matrix", "Compatibility matrix", "Supported Postgres, Redis, OS"),
    ],
}

# Load-bearing pages — written separately with real content. Never stubbed.
SKIP = {
    "getting-started/what-is-sif.md",
    "getting-started/installation.md",
    "getting-started/quickstart.md",
    "getting-started/architecture-overview.md",
}

STUB = """---
title: {title}
description: {description}
---

> **Status: not yet written.** This page is a planned stub in the user-guide scaffold. Content will be filled in as the surrounding sections stabilise.

This page will cover:

- {description}
"""

INDEX_TEMPLATE = """---
title: {title}
description: {orientation}
---

{orientation}

## Pages in this section

| Page | What it covers |
|---|---|
{rows}
"""


def main() -> None:
    created = 0
    skipped = 0
    BASE.mkdir(parents=True, exist_ok=True)

    for subdir, entries in SECTIONS.items():
        section_dir = BASE / subdir
        section_dir.mkdir(parents=True, exist_ok=True)

        # Section index page
        index_path = section_dir / "index.md"
        if not index_path.exists():
            rows = "\n".join(
                f"| [{title}]({stem}.md) | {desc} |"
                for stem, title, desc in entries
            )
            index_path.write_text(
                INDEX_TEMPLATE.format(
                    title=SECTION_TITLES[subdir],
                    orientation=SECTION_ORIENTATION[subdir],
                    rows=rows,
                )
            )
            created += 1
        else:
            skipped += 1

        # Per-page stubs
        for stem, title, desc in entries:
            rel = f"{subdir}/{stem}.md"
            if rel in SKIP:
                skipped += 1
                continue
            path = section_dir / f"{stem}.md"
            if not path.exists():
                path.write_text(STUB.format(title=title, description=desc))
                created += 1
            else:
                skipped += 1

    print(f"created={created} skipped={skipped}")


if __name__ == "__main__":
    main()
