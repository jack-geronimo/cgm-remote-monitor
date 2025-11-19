/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nightscout BG Colors
        'bg-urgent': '#EF4444',      // Red
        'bg-warning': '#F59E0B',     // Yellow/Orange
        'bg-success': '#10B981',     // Green
        'bg-info': '#3B82F6',        // Blue

        // Dark Mode Surfaces
        'surface-0': '#0F172A',      // Darkest background
        'surface-1': '#1E293B',      // Cards
        'surface-2': '#334155',      // Hover
        'surface-3': '#475569',      // Border

        // Light Mode Surfaces
        'light-surface-0': '#FFFFFF',
        'light-surface-1': '#F8FAFC',
        'light-surface-2': '#E2E8F0',
        'light-surface-3': '#CBD5E1',

        // Text
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      fontSize: {
        'bg-display': '7rem',        // 112px for BG value
        'bg-display-sm': '5rem',     // 80px for mobile
        'trend-arrow': '5.5rem',     // 88px for trend
        'trend-arrow-sm': '4rem',    // 64px for mobile
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
