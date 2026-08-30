/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fef7ee",
          100: "#fdecd3",
          200: "#fbd5a6",
          300: "#f8b76e",
          400: "#f48f34",
          500: "#f17012",
          600: "#e25708",
          700: "#bb3f09",
          800: "#953310",
          900: "#782c10",
          950: "#411306",
        },
      },
    },
  },
  plugins: [],
};
