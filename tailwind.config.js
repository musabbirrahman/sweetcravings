/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Three core colours + one accent. Everything else in the old
        // palette was a near-duplicate tint of one of these and is gone:
        // borders use chocolate at low opacity, tints use caramel/forest
        // at low opacity, light text on dark surfaces is cream.
        brand: {
          chocolate: "#2C1E19", // Deep cocoa — text, buttons, dark surfaces
          caramel: "#9C6237", // Warm caramel — the one accent colour for CTAs
          cream: "#FAF7F2", // Warm cream — page background, light text on dark
          taupe: "#6D5C53", // Muted cocoa — body text on cream
          gold: "#8A6B3F", // Darkened gold — small text that must pass contrast
          forest: "#2D5943", // Deep green — success, WhatsApp, secondary accent
        }
      },
      fontFamily: {
        // Two self-hosted families only (@fontsource, no Google request):
        // Fraunces for display headings, Hind Siliguri for body + Bangla.
        heading: ["Fraunces Variable", "Hind Siliguri", "Georgia", "serif"],
        sans: ["Hind Siliguri", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        bengali: ["Hind Siliguri", "Noto Sans Bengali", "sans-serif"],
        editorial: ["Fraunces Variable", "Hind Siliguri", "Georgia", "serif"],
        serif: ["Fraunces Variable", "Hind Siliguri", "Georgia", "serif"],
      },
      boxShadow: {
        'soft': '0 2px 16px -2px rgba(60, 40, 30, 0.04)',
        'soft-hover': '0 8px 28px -4px rgba(60, 40, 30, 0.08)',
        'card': '0 2px 10px -1px rgba(60, 40, 30, 0.03), 0 1px 3px 0 rgba(60, 40, 30, 0.02)',
        'card-hover': '0 12px 32px -4px rgba(60, 40, 30, 0.08), 0 4px 10px -2px rgba(60, 40, 30, 0.03)',
        'float': '0 16px 40px -6px rgba(60, 40, 30, 0.10)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 2.5s infinite',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.35s ease-out forwards',
      }
    },
  },
  plugins: [],
};
