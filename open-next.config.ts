import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      // This tells Next.js to use the KV namespace you defined in Step 2
      incrementalCache: "api",
      tagCache: "api",
      queue: "api",
    },
  },
  middleware: {
    external: true,
  },
} as OpenNextConfig;