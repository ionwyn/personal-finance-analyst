import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "array-callback-return": "error",
      "default-case-last": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-duplicate-imports": "error",
      "no-eval": "error",
      "no-implicit-coercion": "error",
      "no-implied-eval": "error",
      "no-return-await": "error",
      "no-template-curly-in-string": "error",
      "no-throw-literal": "error",
      "no-unneeded-ternary": "error",
      "object-shorthand": ["error", "always"],
      "prefer-const": ["error", { destructuring: "all" }],
    },
  },
  // `settings.jsx` is a standalone UI/UX design reference mockup (not app code).
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "dist/**",
    "tsconfig.tsbuildinfo",
    "settings.jsx",
  ]),
]);
