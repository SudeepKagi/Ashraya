// FILE: client/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        medical: {
          teal: '#00B4A6',
          amber: '#F5A623',
          coral: '#FF6B6B',
          navy: '#0A0F1E',
          surface: 'rgba(255,255,255,0.05)',
        }
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '16px',
      }
    }
  }
};
