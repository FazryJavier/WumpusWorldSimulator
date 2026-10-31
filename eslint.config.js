import js from "@eslint/js";
import globals from "globals";

const PURE_GLOBALS_BAN = ["window", "document", "localStorage", "navigator"].map((name) => ({
    name,
    message: "engine/ dan agent/ harus murni (ARCHITECTURE §2).",
}));
const NO_RANDOM = { object: "Math", property: "random", message: "Gunakan engine/rng.js." };

export default [
    { ignores: ["node_modules/**", "docs/design/**", "coverage/**"] },
    js.configs.recommended,
    {
        files: ["js/**/*.js"],
        languageOptions: { sourceType: "module", globals: { ...globals.browser } },
        rules: { "no-var": "error", "prefer-const": "error", eqeqeq: "error" },
    },
    {
        files: ["js/engine/**/*.js"],
        rules: {
            "no-restricted-globals": ["error", ...PURE_GLOBALS_BAN, { name: "Date", message: "Engine harus deterministik." }],
            "no-restricted-properties": ["error", NO_RANDOM],
            "no-restricted-imports": ["error", { patterns: ["**/agent/**", "**/app/**", "**/ui/**"] }],
        },
    },
    {
        files: ["js/agent/**/*.js"],
        rules: {
            "no-restricted-globals": ["error", ...PURE_GLOBALS_BAN],
            "no-restricted-properties": ["error", NO_RANDOM],
            "no-restricted-imports": ["error", { patterns: ["**/app/**", "**/ui/**"] }],
        },
    },
    {
        files: ["js/app/**/*.js"],
        rules: {
            "no-restricted-globals": ["error", "document", "window"],
            "no-restricted-imports": ["error", { patterns: ["**/ui/**"] }],
        },
    },
    {
        files: ["js/ui/**/*.js"],
        rules: { "no-restricted-imports": ["error", { patterns: ["**/agent/**"] }] },
    },
    {
        files: ["tests/**/*.js", "scripts/**/*.js", "*.cjs"],
        languageOptions: { globals: globals.node },
    },
    {
        files: ["*.cjs"],
        languageOptions: { sourceType: "commonjs" },
    },
];
