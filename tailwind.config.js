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
        // Restrained warm palette (redesign 2026-11-08). ONE muted accent
        // (caramel, darkened so it passes AA on cream). Primary CTAs are
        // solid ink. Forest green survives ONLY for success states and
        // the small WhatsApp icon — never as a surface or block. Gold is gone.
        brand: {
          chocolate: "#221A14", // Ink — text, buttons, dark surfaces
          caramel: "#8A5A33", // Muted caramel — the one accent (text, thin borders)
          cream: "#FBF9F6", // Warm off-white — page background
          taupe: "#6B5D52", // Muted cocoa — secondary text on cream
          forest: "#2D5943", // Deep green — success states + WhatsApp icon only
        }
      },
      fontFamily: {
        // ONE family only: Hind Siliguri for everything (Latin + Bangla).
        // Fraunces is gone — it has no Bangla glyphs, so Bangla headlines
        // fell back while Latin rendered in serif, and its italic was a
        // faux-oblique Bangla. No italics anywhere in the redesign.
        heading: ["Hind Siliguri", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        sans: ["Hind Siliguri", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        bengali: ["Hind Siliguri", "Noto Sans Bengali", "sans-serif"],
        editorial: ["Hind Siliguri", "system-ui", "sans-serif"],
        serif: ["Hind Siliguri", "system-ui", "sans-serif"],
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
