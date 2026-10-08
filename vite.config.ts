import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  fmt: {},
  lint: {
    plugins: ["react", "typescript", "oxc", "unicorn", "vitest"],
    // Oxlint's default rule set (correctness) only warns, and warnings don't fail `vp check`,
    // so without this a missing `key` or a floating promise passes CI green.
    categories: { correctness: "error" },
    rules: {
      // Not in the correctness category, so it must be named here or it's off. Error, not warn:
      // the React Compiler silently skips a component that breaks the Rules of Hooks.
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // The designsystem alone puts the entry chunk at ~530 kB (Digdir doesn't tree-shake), so the
  // 500 kB default warned on every build and got ignored. Set just above today's size, so the
  // warning means something again: raise it on purpose, with the reason, when it fires.
  build: {
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
  // React Compiler through the Rolldown babel preset. @vitejs/plugin-react 6 silently ignores
  // the older `react({ babel: { plugins } })` form, so this is the wiring that actually runs.
  plugins: lazyPlugins(() => [react(), babel({ presets: [reactCompilerPreset()] })]),
});
