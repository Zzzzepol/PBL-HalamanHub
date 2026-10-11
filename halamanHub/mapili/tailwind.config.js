/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e8f7ef',
          100: '#d0f0e0',
          200: '#a8e6bf',
          300: '#4cc97a',
          400: '#3dbf6e',
          500: '#27a85a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#123f25',
        },
        earth: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f3d9a8',
          300: '#eabc6b',
          400: '#e09e3a',
          500: '#d4861e',
          600: '#b86c14',
          700: '#985213',
          800: '#7c4116',
          900: '#673616',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '15px',
        md: '15px',
        lg: '18px',
        xl: '22px',
        '2xl': '28px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        card: '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
        lift: '0 10px 30px rgba(15,23,42,0.10)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
