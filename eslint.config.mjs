// @ts-check
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  eslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    rules: {
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "coverage/**"],
  },
];

export default config;
