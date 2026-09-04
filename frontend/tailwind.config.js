/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // The rest of the app ships hand-written CSS. Disable Preflight so Tailwind's
  // global reset can't restyle those pages — utilities still work everywhere.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        'pm-green': '#22c55e',
        'pm-green-dark': '#16a34a',
        'pm-blue': '#2563eb',
        'pm-ink': '#1f2937',
        'pm-muted': '#6b7280',
      },
    },
  },
  plugins: [],
}
