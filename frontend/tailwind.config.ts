import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        canvas: 'var(--canvas)',
        midnight: 'var(--midnight)',
        ink: 'var(--ink)',
        mint: 'var(--mint)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-sans)', 'sans-serif'],
        logo: ['"Major Mono Display"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
