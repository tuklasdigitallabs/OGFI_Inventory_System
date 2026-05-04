import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        og: {
          green: '#0E4D13',
          orange: '#F3AB1B',
          beige: '#FFDCA6',
          dark: '#1C1C1C',
          gray: '#6B7280',
          line: '#E5E7EB',
          info: '#2563EB',
          error: '#DC2626',
        },
      },
      fontFamily: {
        inter: ['Inter', 'Arial', 'sans-serif'],
        poppins: ['Poppins', 'Inter', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(28, 28, 28, 0.08)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
