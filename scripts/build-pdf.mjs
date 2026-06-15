#!/usr/bin/env node
/**
 * Render the built Starlight site to a single PDF.
 *
 * Walks dist/ for index.html files in sidebar order, renders each via
 * Playwright (against a tiny local HTTP server so root-relative URLs
 * resolve), and merges the page PDFs into one document via pdf-lib.
 *
 * Base-path-aware: reads `base` from astro.config.mjs and serves dist/
 * under that prefix, so the URLs Astro bakes into every asset and link
 * (e.g. `/sif-docs/_astro/foo.css`) resolve correctly.
 *
 * Run via `make pdf` (which builds first). Direct usage:
 *   node scripts/build-pdf.mjs <output.pdf>
 */

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

const OUTPUT = process.argv[2];
if (!OUTPUT) {
  console.error("usage: node scripts/build-pdf.mjs <output.pdf>");
  process.exit(1);
}

// Base path Astro baked into the built HTML (e.g. "/sif-docs"), populated
// in main() by sniffing dist/index.html. Reading the built output keeps us
// honest about what Astro actually emitted — and avoids importing
// astro.config.mjs at runtime, which transitively pulls in Starlight's
// TypeScript sources and chokes modern Node.
let BASE = "";

// Sidebar section order — must match astro.config.mjs.
// "" = repo root (the index.md landing page).
const SECTIONS = [
  "",
  "getting-started",
  "concepts",
  "dashboard",
  "api",
  "sdks",
  "guides",
  "deployment",
  "operations",
  "reference",
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Look at any asset href in the landing page to extract the prefix Astro
// applied. Returns "" if no base is configured.
async function detectBase() {
  const html = await readFile(join(DIST, "index.html"), "utf8");
  const m = html.match(/href="(\/[\w./-]*?)\/_astro\//);
  return m ? m[1] : "";
}

async function findPages() {
  const pages = [];
  for (const section of SECTIONS) {
    const sectionDir = section ? join(DIST, section) : DIST;
    if (!(await exists(sectionDir))) continue;

    if (section) {
      // The section's own landing page (e.g. dist/api/index.html)
      const sectionIndex = join(sectionDir, "index.html");
      if (await exists(sectionIndex)) {
        pages.push({ url: `${BASE}/${section}/`, label: `${section}/` });
      }
    } else {
      // Repo root landing
      const rootIndex = join(DIST, "index.html");
      if (await exists(rootIndex)) {
        pages.push({ url: `${BASE}/`, label: "index" });
      }
    }

    const entries = await readdir(sectionDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      // Subsections inside a section, e.g. dist/api/authentication/index.html
      const subIndex = join(sectionDir, entry.name, "index.html");
      if (!(await exists(subIndex))) continue;
      const url = section
        ? `${BASE}/${section}/${entry.name}/`
        : `${BASE}/${entry.name}/`;
      pages.push({ url, label: section ? `${section}/${entry.name}` : entry.name });
    }
  }
  return pages;
}

function startServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
  };
  return new Promise((res) => {
    const server = createServer(async (req, response) => {
      let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      // Strip the base prefix so /sif-docs/api/foo.html → dist/api/foo.html.
      if (BASE && urlPath.startsWith(BASE)) {
        urlPath = urlPath.slice(BASE.length) || "/";
      }
      if (urlPath.endsWith("/")) urlPath += "index.html";
      const filePath = join(DIST, urlPath);
      try {
        const data = await readFile(filePath);
        response.writeHead(200, {
          "Content-Type": mime[extname(filePath)] || "application/octet-stream",
        });
        response.end(data);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      res({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  BASE = await detectBase();
  if (BASE) console.log(`▶ detected base prefix: ${BASE}`);
  console.log("▶ enumerating rendered pages…");
  const pages = await findPages();
  if (pages.length === 0) {
    console.error("no pages found in dist/ — did `npm run build` succeed?");
    process.exit(1);
  }
  console.log(`  ${pages.length} pages`);

  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const merged = await PDFDocument.create();

  try {
    for (const [i, p] of pages.entries()) {
      const idx = String(i + 1).padStart(2, " ");
      process.stdout.write(`  [${idx}/${pages.length}] ${p.label}`);
      await page.goto(`${baseUrl}${p.url}`, { waitUntil: "networkidle" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
      const sub = await PDFDocument.load(buf);
      const copied = await merged.copyPages(sub, sub.getPageIndices());
      copied.forEach((pg) => merged.addPage(pg));
      process.stdout.write(" ✓\n");
    }
  } finally {
    await browser.close();
    server.close();
  }

  const out = await merged.save();
  await writeFile(OUTPUT, out);
  console.log(`✓ wrote ${OUTPUT} (${(out.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error("✗ pdf build failed:");
  console.error(err);
  process.exit(1);
});
