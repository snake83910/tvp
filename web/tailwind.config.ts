import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Charte issue du logo tousvospneus.com
        ink: {
          DEFAULT: "#161616", // noir profond (fond principal)
          soft: "#1f1f1f",
          muted: "#2a2a2a",
        },
        signal: {
          DEFAULT: "#D8232A", // rouge signature
          dark: "#b01c22",
          light: "#e8474d",
        },
        bone: {
          DEFAULT: "#f4f1ea", // blanc cassé (texte sur fond sombre)
          dim: "#a8a39a",
        },
      },
      fontFamily: {
        // Display à fort caractère + corps lisible
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
