/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#e8f7ef',
          100: '#d0f0e0',
          200: '#a8e6bf',
          400: '#4cc97a',
          500: '#3dbf6e',
          600: '#27a85a',
          700: '#1f7d44',
          800: '#1a6b3a',
          900: '#0f3d22',
        },
        amber: {
          50: '#fffbee',
          100: '#fff3cd',
          400: '#f0b429',
          600: '#c4960f',
          700: '#a37c18',
          800: '#8b6914',
        },
        red: {
          50: '#fff5f5',
          100: '#fde8e8',
          400: '#e03535',
          600: '#c42727',
          800: '#8b1414',
        },
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2d7dd2',
          700: '#1a5fb4',
          800: '#0e3d7a',
        },
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          medium: 'var(--border-medium)',
          strong: 'var(--border-strong)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        lg: '0 10px 30px rgba(0,0,0,0.1)',
      },
      spacing: {
        sidebar: '220px',
        'sidebar-collapsed': '60px',
        topbar: '58px',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.6, transform: 'scale(0.88)' },
        },
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeInUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeInOnly: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.5s infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
        'fade-in-only': 'fadeInOnly 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
