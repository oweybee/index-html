/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pitch: '#0d0f0e',
        surface: '#141714',
        line: '#1e221e',
        muted: '#2a2f2a',
        ghost: '#4a524a',
        dim: '#7a877a',
        chalk: '#e8ede8',
        signal: '#39ff6e',
        warn: '#ff6b35',
        amber: '#f5a623',
        ruby: '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
