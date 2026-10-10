import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E',
          dark: '#134E4A',
          light: '#14B8A6',
        },
        surface: '#F3F4F6',
        severity: {
          high: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
          medium: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
          low: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
          ok: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
        },
      },
      boxShadow: {
        glow: '0 10px 30px -10px rgba(15, 118, 110, 0.45)',
        card: '0 4px 20px -8px rgba(15, 23, 42, 0.15)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '70ch',
          },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
