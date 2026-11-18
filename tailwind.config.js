export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { ink: 'var(--ink)', muted: 'var(--muted)', electric: 'var(--accent)', panel: 'var(--surface)' },
      fontFamily: { sans: ['Manrope Variable', 'sans-serif'], display: ['Space Grotesk Variable', 'sans-serif'], mono: ['IBM Plex Mono', 'monospace'] },
      keyframes: { meshShift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-4%,3%,0) scale(1.12)' } } },
      animation: { mesh: 'meshShift 24s ease-in-out infinite' },
    },
  },
  plugins: [],
};
