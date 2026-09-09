/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',

  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        /*
         * Primary application colors
         */
        primary: '#1A56A0',
        lightblue: '#D5E8F0',

        /*
         * PharmaDesk brand palette
         *
         * One single brand object is intentionally used here
         * to avoid duplicate Tailwind configuration keys.
         */
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',

          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1E3A8A',
        },

        /*
         * Application surfaces
         *
         * These are useful for dashboards, cards,
         * sidebars and dark mode layouts.
         */
        surface: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },

        /*
         * Dark dashboard palette
         */
        darkbg: {
          50: '#F8FAFC',
          100: '#EEF2F7',
          200: '#D8E0EC',
          300: '#B8C4D6',
          400: '#94A3B8',
          500: '#71809A',
          600: '#56657F',
          700: '#3F4C63',
          800: '#29354A',
          900: '#182235',
          950: '#0B1120',
        },

        /*
         * Semantic status colors
         *
         * Useful for stock, expiry, alerts,
         * billing and notification states.
         */
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },

        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },

        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },

        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },

        /*
         * Existing application aliases
         */
        greenAccent: '#16A34A',
        orangeAccent: '#D97706',
        redAccent: '#DC2626',

        bgLight: '#F8FAFC',
        textDark: '#1F2937',
      },

      /*
       * Typography
       */
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      /*
       * Slightly more polished application-level radius
       */
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },

      /*
       * Useful pharmacy dashboard shadows
       */
      boxShadow: {
        soft: '0 8px 30px rgba(15, 23, 42, 0.06)',
        card: '0 4px 20px rgba(15, 23, 42, 0.06)',
        elevated: '0 16px 40px rgba(15, 23, 42, 0.10)',
      },

      /*
       * Smooth application transitions
       */
      transitionDuration: {
        250: '250ms',
      },
    },
  },

  plugins: [],
};