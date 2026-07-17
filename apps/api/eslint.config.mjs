import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["**/*.ts", "**/*.mjs"],
  languageOptions: { globals: { ...globals.node, ...globals.bun } },
  rules: {
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "import", next: "*" },
      { blankLine: "any", prev: "import", next: "import" },
      {
        blankLine: "always",
        prev: "*",
        next: ["function", "class", "return", "block-like"],
      },
      {
        blankLine: "always",
        prev: ["function", "class", "block-like"],
        next: "*",
      },
    ],
    curly: ["error", "all"],
    "@typescript-eslint/consistent-type-imports": "error",
  },
});
