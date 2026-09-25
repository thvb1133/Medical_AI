import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        calm: {
          50: "#f2f7f6",
          100: "#dceae8",
          200: "#bad6d2",
          300: "#8fbab5",
          400: "#629a95",
          500: "#477e7a",
          600: "#376562",
          700: "#2e5150",
          800: "#284241",
          900: "#243837",
          950: "#101f1f",
        },
        alert: {
          100: "#fde8e8",
          300: "#f7a9a9",
          500: "#e05252",
          700: "#9b2c2c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { transform: "scale(1.25)", opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 260ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
