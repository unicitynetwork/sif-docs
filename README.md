# Unicity SIF Gateway User Guide v1-01

The SIF Gateway is a request message classifier that enables deep scanning of content passed to and from users, agents, LLMs, tools, and from external activities (such as web scraping). The Gateway can be used to examine individual requests for suspicious content, such as jailbreak attempts, direct and indirect prompt injection, and data leakage. Different scanning policies can be defined and applied on a per request basis.

Built with [Starlight](https://starlight.astro.build/) (Astro).

> Note: The term **Semantic Firewall** is a placeholder used consistently
> throughout this repo so it can be replaced via find-and-replace once the
> final name is settled.

## Develop

```bash
npm install
npm run dev    # http://localhost:4321
```

## Build

```bash
npm run build
npm run preview
```

## Repository layout

```
.
├── astro.config.mjs              # Starlight config (sidebar, integrations)
├── package.json
├── tsconfig.json
├── src/
│   └── content/
│       └── docs/                 # all markdown content
│           ├── index.md          # landing page
│           ├── getting-started/
│           ├── concepts/
│           ├── dashboard/
│           ├── api/
│           ├── sdks/
│           ├── guides/
│           ├── deployment/
│           ├── operations/
│           └── reference/
└── _planning/
    ├── scaffold-and-research.md  # the research that informed the scaffold
    └── build-stubs.py            # regenerates section indexes + stubs
```

## Regenerating the scaffold

The Python script `_planning/build-stubs.py` creates section index pages and
per-page stubs without overwriting existing files. Run it whenever a new
section is added to the plan:

```bash
python3 _planning/build-stubs.py
```

## Writing pages

- Stubs live next to written pages. Replace the stub content when ready.
- API endpoint pages are marked **beta** in their titles where the shape
  may change before 1.0.
- Use the impersonal voice — describe what the product does, not what "we"
  did. Avoid internal-dev framing.

See `_planning/scaffold-and-research.md` for the background on this
structure.
