// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  // Set to the production URL when one exists.
  // site: "https://docs.unicity-aos9.example.com",
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
