/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contents/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
