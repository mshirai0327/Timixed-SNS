import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', 'Zen Kaku Gothic New', 'system-ui', 'sans-serif'],
        display: ['Zen Kaku Gothic New', 'Noto Sans JP', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#0d0d12',
        mist: '#b8b8c9',
        glow: '#a78bfa',
        ember: '#7c3aed',
        line: '#222233'
      },
      boxShadow: {
        soft: '0 16px 40px rgba(0, 0, 0, 0.35)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -10px, 0)' }
        }
      },
      animation: {
        rise: 'rise 600ms ease-out both',
        drift: 'drift 9s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
