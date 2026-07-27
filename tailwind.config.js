/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vnpt: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#005baa',
          600: '#004c91',
          700: '#003d78',
          800: '#0a2e5c',
          900: '#061d3d',
        }
      }
    },
  },
  plugins: [],
}
