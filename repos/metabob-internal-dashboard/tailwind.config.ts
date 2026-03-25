import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        metabob: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#22d3ee',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          text: '#e2e8f0',
          muted: '#64748b',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
