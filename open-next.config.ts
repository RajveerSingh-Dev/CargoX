// @ts-nocheck
import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node", // Ensures node-postgres compatibility
      converter: "edge",
      // Reverted to strings for type-checking compliance during build
      incrementalCache: "api",
      tagCache: "api",
      queue: "api",
    },
  },
  middleware: {
    external: true,
  },
} as OpenNextConfig;