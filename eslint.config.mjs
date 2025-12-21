import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      // function naming rules
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "function",
          format: ["camelCase", "PascalCase"], // allow camelCase fot function and PascalCase for React Components, eg:handleClick 和 MyComponent
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"], // allow variables to be named : myVar, MY_CONST, MyComponent
        },
      ],
    },
  },
]);

export default eslintConfig;
