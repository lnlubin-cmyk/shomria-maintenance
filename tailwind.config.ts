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
          500: "#2f7d5d",
          600: "#25654a",
          700: "#1c4d38",
        },
      },
    },
  },
  plugins: [],
};

export default config;
