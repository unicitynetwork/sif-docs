#!/usr/bin/env node
/**
 * Prepare a copy of dist/ where every server-absolute URL has been
 * rewritten to page-relative form, so the extracted ZIP works via
 * file:// (double-click index.html, no web server needed).
 *
 *   /sif-docs/concepts/rules/      ->  ../concepts/rules/index.html
 *   /sif-docs/_astro/print.css     ->  ../../_astro/print.css   (from depth 2)
 *   /sif-docs/                     ->  ./index.html  (suffixed because file://
 *                                                     doesn't auto-resolve
 *                                                     trailing-slash dirs)
 *
 * Site without a configured `base` (URLs are root-absolute already, no prefix)
 * is detected and short-circuited — nothing to rewrite.
 *
 * Usage: node scripts/prepare-zip.mjs <source-dir> <staging-dir>
 */

import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const [, , SRC_ARG, OUT_ARG] = process.argv;
if (!SRC_ARG || !OUT_ARG) {
  console.error("usage: node scripts/prepare-zip.mjs <source-dir> <staging-dir>");
  process.exit(1);
}
const SRC = resolve(SRC_ARG);
const OUT = resolve(OUT_ARG);

await cp(SRC, OUT, { recursive: true });

// Sniff the prefix from the landing page (same approach as build-pdf.mjs).
const indexHtml = await readFile(join(OUT, "index.html"), "utf8");
const baseMatch = indexHtml.match(/href="(\/[\w./-]*?)\/_astro\//);
const BASE = baseMatch ? baseMatch[1] : "";

if (!BASE) {
  console.log("(no base prefix detected — nothing to rewrite)");
  process.exit(0);
}

async function* walk(dir, predicate) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p, predicate);
    else if (entry.isFile() && predicate(entry.name)) yield p;
  }
}

function relPrefixFor(filePath) {
  const rel = relative(OUT, dirname(filePath));
  if (!rel) return "";
  return "../".repeat(rel.split(sep).length);
}

// Returns the rewritten URL, or null if untouched.
function rewriteUrl(url, relPrefix) {
  if (!url.startsWith(BASE)) return null;
  const rest = url.slice(BASE.length);
  if (!rest || rest === "/") return `${relPrefix}index.html`;
  if (!rest.startsWith("/")) return null; // e.g. "/sif-docs2/foo" — unrelated
  const m = rest.match(/^(\/[^?#]*)(.*)$/);
  if (!m) return null;
  let path = m[1].replace(/^\//, "");
  const tail = m[2];
  // Trailing-slash directory or root: file:// needs the explicit index.html.
  if (!path || path.endsWith("/")) path += "index.html";
  return `${relPrefix}${path}${tail}`;
}

let totalEdits = 0;
let fileCount = 0;

for await (const file of walk(OUT, (n) => /\.html?$/i.test(n))) {
  fileCount++;
  const relPrefix = relPrefixFor(file);
  const text = await readFile(file, "utf8");
  let edits = 0;

  // href / src / content (covers <a>, <link>, <script>, <img>, <meta og:*>).
  let out = text.replace(
    /\b(href|src|content)="([^"]*)"/g,
    (m, attr, url) => {
      const r = rewriteUrl(url, relPrefix);
      if (r == null) return m;
      edits++;
      return `${attr}="${r}"`;
    },
  );

  // srcset — comma-separated URL + descriptor pairs.
  out = out.replace(/\bsrcset="([^"]+)"/g, (m, val) => {
    let touched = false;
    const next = val
      .split(",")
      .map((p) => {
        const t = p.trim();
        const [u, ...rest] = t.split(/\s+/);
        const r = rewriteUrl(u, relPrefix);
        if (r == null) return t;
        touched = true;
        return [r, ...rest].join(" ");
      })
      .join(", ");
    if (!touched) return m;
    edits++;
    return `srcset="${next}"`;
  });

  // url(...) inside <style> blocks or inline style attributes.
  out = out.replace(/url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/g, (m, q, url) => {
    const r = rewriteUrl(url, relPrefix);
    if (r == null) return m;
    edits++;
    return `url(${q}${r}${q})`;
  });

  if (edits > 0) {
    await writeFile(file, out);
    totalEdits += edits;
  }
}

console.log(
  `✓ rewrote ${totalEdits} URLs across ${fileCount} HTML files (base prefix: ${BASE})`,
);
