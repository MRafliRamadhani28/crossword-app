/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          yellow: '#FFE500',
          green: '#39FF14',
          pink: '#FF2D78',
          blue: '#00C8FF',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-danger': 'pulse-danger 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
