/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Softer purple palette - more muted and easy on eyes
        purple: {
          50: '#faf8fc',
          100: '#f4f0f9',
          200: '#e9dff3',
          300: '#d9c7ea',
          400: '#c4a8dd',
          500: '#a882c8',
          600: '#8b5fb8',
          700: '#7348a0',
          800: '#5f3c84',
          900: '#4e326c',
          950: '#321f49',
        },
      },
    },
  },
  plugins: [],
}
