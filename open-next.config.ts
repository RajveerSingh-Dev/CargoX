import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      // Use dynamic imports pointing to the Cloudflare KV cache instead of the "api" string
      incrementalCache: () => import("@opennextjs/cloudflare/kv-cache"),
      tagCache: () => import("@opennextjs/cloudflare/kv-cache"),
      queue: () => import("@opennextjs/cloudflare/queue"),
    },
  },
  middleware: {
    external: true,
  },
} as OpenNextConfig;