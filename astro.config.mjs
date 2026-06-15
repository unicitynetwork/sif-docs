// @ts-check
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Project Pages site base path. Shared by Astro's `base` and the Markdown link
// rewriter below so the two can never drift apart.
const SITE_BASE = "/sif-docs";

// Absolute path to the Starlight content root, resolved from this config file's
// location so it is independent of the working directory and OS.
const DOCS_DIR = fileURLToPath(new URL("./src/content/docs", import.meta.url));

/**
 * Rewrite relative Markdown links (e.g. `../concepts/rules.md` or `../deployment/`)
 * to their final Starlight routes (e.g. `/sif-docs/concepts/rules/`). Astro does
 * not resolve links inside content collections, and a page's clean URL gains a
 * directory level (`installation.md` -> `/installation/`), so file-relative
 * links such as `../deployment/` would otherwise 404. Each link is resolved
 * against its source file and rewritten only when it maps to a real page — an
 * `.md`/`.mdx` file (with or without the extension) or a directory with an
 * `index` page — so non-page links are left untouched.
 */
function remarkRelativeMarkdownLinks() {
  return (/** @type {any} */ tree, /** @type {any} */ file) => {
    const filePath = file?.history?.[0] ?? file?.path;
    if (!filePath || !path.isAbsolute(filePath)) return;
    const currentDir = path.dirname(filePath);

    const rewrite = (/** @type {any} */ node) => {
      const url = node.url;
      // Leave external URLs, protocol/mailto, root-absolute, and bare anchors.
      if (/^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(url)) return;
      const match = url.match(/^([^#?]+)([?#].*)?$/);
      if (!match) return;
      const targetAbs = path.resolve(currentDir, match[1]);

      // Resolve the link to the real source page; bail if it is not one.
      let pageFile = null;
      if (/\.mdx?$/i.test(targetAbs) && fs.existsSync(targetAbs)) {
        pageFile = targetAbs; // explicit .md/.mdx
      } else if (fs.existsSync(`${targetAbs}.md`)) {
        pageFile = `${targetAbs}.md`; // extensionless file link
      } else if (fs.existsSync(`${targetAbs}.mdx`)) {
        pageFile = `${targetAbs}.mdx`;
      } else if (fs.existsSync(path.join(targetAbs, "index.md"))) {
        pageFile = path.join(targetAbs, "index.md"); // directory index
      } else if (fs.existsSync(path.join(targetAbs, "index.mdx"))) {
        pageFile = path.join(targetAbs, "index.mdx");
      }
      if (!pageFile) return;

      let rel = path.relative(DOCS_DIR, pageFile).replace(/\\/g, "/");
      if (rel.startsWith("..")) return; // outside the docs tree; leave as-is
      rel = rel.replace(/\.mdx?$/i, "").replace(/(^|\/)index$/i, "$1");
      let out = `${SITE_BASE}/${rel}`.replace(/\/{2,}/g, "/");
      if (!out.endsWith("/")) out += "/";
      node.url = out + (match[2] ?? "");
    };

    const walk = (/** @type {any} */ node) => {
      if (node.type === "link" && typeof node.url === "string") rewrite(node);
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  // Deployed to GitHub Pages as a project site:
  // https://unicitynetwork.github.io/sif-docs/
  // `base` must match the repo name so internal links and assets resolve.
  site: "https://unicitynetwork.github.io",
  base: SITE_BASE,
  markdown: {
    remarkPlugins: [remarkRelativeMarkdownLinks],
  },
  integrations: [
    starlight({
      title: "Semantic Firewall",
      description:
        "Self-hosted LLM security gateway — detection, policy, threat review.",
      lastUpdated: true,
      sidebar: [
        {
          label: "Getting started",
          items: [{ autogenerate: { directory: "getting-started" } }],
        },
        {
          label: "Concepts",
          items: [{ autogenerate: { directory: "concepts" } }],
        },
        {
          label: "Dashboard",
          items: [{ autogenerate: { directory: "dashboard" } }],
        },
        {
          label: "HTTP API",
          items: [{ autogenerate: { directory: "api" } }],
        },
        {
          label: "SDKs",
          items: [{ autogenerate: { directory: "sdks" } }],
        },
        {
          label: "How-to guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
        {
          label: "Deployment",
          badge: { text: "post-alpha", variant: "caution" },
          items: [{ autogenerate: { directory: "deployment" } }],
        },
        {
          label: "Operations",
          badge: { text: "post-alpha", variant: "caution" },
          items: [{ autogenerate: { directory: "operations" } }],
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "reference" } }],
        },
      ],
    }),
  ],
});
