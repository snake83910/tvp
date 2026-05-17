import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Refonte : fond clair marchand, rouge action, anthracite structure
        paper: { DEFAULT: "#ffffff", soft: "#f6f6f4", dim: "#ecebe7" },
        ink: { DEFAULT: "#17181a", soft: "#33363b", muted: "#6b6f76" },
        signal: { DEFAULT: "#D8232A", dark: "#b01c22", light: "#fdecec" },
        line: { DEFAULT: "#e3e2dd", strong: "#cfcec8" },
        ok: "#1a8a4d",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: { tightest: "-0.035em" },
      boxShadow: {
        card: "0 1px 3px rgba(20,20,20,0.06), 0 1px 2px rgba(20,20,20,0.04)",
        lift: "0 8px 24px rgba(20,20,20,0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
