/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0F17',
        surface: '#111827',
        elevated: '#1A2233',
        line: '#263042',
        ink: '#E5E7EB',
        muted: '#9CA3AF',
        brand: '#6366F1',
        'brand-hover': '#818CF8',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
        info: '#38BDF8',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
