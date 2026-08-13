/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        app: 'var(--bg-app)',
        card: 'var(--bg-card)',
        input: 'var(--bg-input)',
        border: 'var(--border-subtle)',
        primary: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#66b3ff',
          600: '#4da6ff',
          700: '#3b8fe8',
        },
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      borderColor: {
        DEFAULT: 'var(--border-subtle)',
        subtle: 'var(--border-subtle)',
      }
    },
  },
  plugins: [],
};
