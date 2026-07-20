import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Rubik", "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d6ebe0",
          200: "#aed7c2",
          500: "#2f7d5d",
          600: "#25654a",
          700: "#1c4d38",
        },
        // Warm accent taken from the logo's orange.
        accent: {
          50: "#fff5ed",
          100: "#ffe6d4",
          500: "#e8730f",
          600: "#c85d08",
          700: "#9f4a0b",
        },
      },
      boxShadow: {
        soft: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
      },
    },
  },
  plugins: [],
};

export default config;
