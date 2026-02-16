import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./pages/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-geist-sans)"], mono: ["var(--font-geist-mono)"] },
      colors: { track: { 800: "#1a1510", 700: "#2d251c", 600: "#453a2d" }, gold: { 400: "#d4a853", 500: "#c4942e" } },
    },
  },
  plugins: [],
} satisfies Config;
