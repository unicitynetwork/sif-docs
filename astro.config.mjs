// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  // Deployed to GitHub Pages as a project site:
  // https://unicitynetwork.github.io/sif-docs/
  // `base` must match the repo name so internal links and assets resolve.
  site: "https://unicitynetwork.github.io",
  base: "/sif-docs",
  integrations: [
    starlight({
      title: "Unicity-AOS9",
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
          items: [{ autogenerate: { directory: "deployment" } }],
        },
        {
          label: "Operations",
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
