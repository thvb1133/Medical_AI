import type { Config } from "tailwindcss";

/**
 * Palette is sampled from the Neura console design rather than Tailwind's
 * defaults, so the tokens below are the source of truth for both themes.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: { light: "#ffffff", dark: "#111316" },
        panel: { light: "#ffffff", dark: "#191c20" },
        hairline: { light: "#e6e7e9", dark: "#2a2e34" },
        ink: {
          900: "#16181c",
          700: "#3c4149",
          500: "#6b7280",
          400: "#8a8f98",
          300: "#a8adb6",
        },
        vital: "#17a34a",
        progress: "#2fbf5f",
        accent: { DEFAULT: "#2e7df0", hover: "#1f6ad8" },
        danger: { DEFAULT: "#e0393e", hover: "#c62a2f" },
        bubble: { user: "#1c1c1e", agent: "#f1f2f4" },
        safe: { bg: "#ecfdf3", border: "#b7ebc6", text: "#1a7f43" },
        scale: {
          low: "#17a34a",
          mid: "#c98a13",
          high: "#e07b26",
          peak: "#d93a3f",
        },
      },
      fontSize: {
        micro: ["9px", { lineHeight: "13px", letterSpacing: "0.09em" }],
        metric: ["10.5px", { lineHeight: "15px" }],
        panel: ["11px", { lineHeight: "16px" }],
      },
      borderRadius: { card: "10px" },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
