// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, Nitro, componentTagger (dev-only),
//     VITE_* env injection, @ path alias, React/TanStack dedupe, error logger plugins, and
//     sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import { loadEnv } from "vite";

// Public Supabase settings are already checked into wrangler.jsonc for the
// Cloudflare runtime. Vite also needs them at build time because browser code
// cannot read Worker runtime bindings. Keep explicit VITE_* build variables as
// the override when a deployment provides them.
const cloudflareConfig = JSON.parse(
  readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8"),
) as {
  vars?: {
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

const adminSignInUrlLogger = {
  name: "edubridge-local-urls",
  config(_config: object, { command, mode }: { command: string; mode: string }) {
    const env = loadEnv(mode, process.cwd(), "");

    if (command === "serve") {
      for (const key of [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RESEND_API_KEY",
        "EMAIL_FROM",
        "APP_URL",
      ]) {
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }
    }

    return {
      define: {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
          env.VITE_SUPABASE_URL || cloudflareConfig.vars?.SUPABASE_URL || "",
        ),
        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
          env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            cloudflareConfig.vars?.SUPABASE_PUBLISHABLE_KEY ||
            "",
        ),
      },
    };
  },
  configureServer(server: import("vite").ViteDevServer) {
    const printLocalUrls = () => {
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") return;
      const host =
        address.address === "::" || address.address === "0.0.0.0" ? "localhost" : address.address;
      const baseUrl = `http://${host}:${address.port}`;
      console.info(
        `\n[EduBridge] Local URLs\n  Main app: ${baseUrl}/\n  Admin sign-in: ${baseUrl}/admin-login\n`,
      );
    };

    if (server.httpServer?.listening) printLocalUrls();
    else server.httpServer?.once("listening", printLocalUrls);
  },
};

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  vite: {
    plugins: [adminSignInUrlLogger],
    optimizeDeps: {
      exclude: ["@tanstack/start-server-core"],
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "cloudflare_pages",
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
});
