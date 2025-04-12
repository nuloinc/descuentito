import { fontFamily } from "tailwindcss/defaultTheme";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "media",
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  safelist: ["dark"],
  theme: {},
  plugins: [tailwindcssAnimate],
};
