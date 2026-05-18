/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a1814', muted: '#6b6760', faint: '#b5b3ae' },
        surface: { DEFAULT: '#faf9f7', raised: '#ffffff' },
        accent: { DEFAULT: '#e85d2f', light: '#fdeee8', dark: '#c0401a' },
        brand: { green: '#1d9e75', 'green-light': '#e1f5ee' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
