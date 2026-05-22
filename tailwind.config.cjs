/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'ui-sans-serif', 'system-ui'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        orbit: {
          bg: '#08111f',
          blue: '#155eef',
          amber: '#f5b841',
          ink: '#f4f7fb',
          muted: '#9fb3c8',
        },
      },
      animation: {
        scanSweep: 'scanSweep 6s ease-in-out infinite',
      },
      keyframes: {
        scanSweep: {
          '0%, 100%': { transform: 'translateX(-28%)', opacity: '.18' },
          '50%': { transform: 'translateX(24%)', opacity: '.34' },
        },
      },
    },
  },
  plugins: [],
};
