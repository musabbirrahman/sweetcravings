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
        brand: {
          chocolate: "#2C1E19", // Softer warm espresso (replaces harsh #241814)
          "chocolate-dark": "#201612", // Softer deep cocoa
          "chocolate-light": "#3D2C24",
          taupe: "#6D5C53", // Softer hazelnut cocoa for readable body text
          "taupe-light": "#9C8C82",
          "taupe-subtle": "#C2B5AC",
          
          caramel: "#9C6237", // Warm, appetizing golden caramel (replaces heavy #8C5630)
          "caramel-dark": "#74431F",
          "caramel-hover": "#89532B",
          "caramel-light": "#EBDCCC",
          "caramel-subtle": "#F7EFE8", // Whipped Chantilly cream tint
          
          gold: "#C29B63", // Soft champagne gold
          "gold-light": "#F4ECE1",
          "gold-muted": "#9B7C50",
          
          cream: "#FAF7F2", // Ultra-soft warm cashmere background (zero glare, gentle on eyes)
          "cream-pure": "#FDFBF8",
          "cream-subtle": "#F5EFE6",
          "cream-dark": "#EAE3D6", // Delicate, clean whisper-soft hairline border
          vanilla: "#FAF5ED",
          surface: "#FFFFFF",
          
          strawberry: "#9B4348", // Soft glazed raspberry
          "strawberry-light": "#FDF2F2",
          
          forest: "#2D5943", // Soft botanical sage
          "forest-light": "#EEF5F1",
          "forest-border": "#C8DFD2",
        }
      },
      fontFamily: {
        heading: ["Outfit", "Plus Jakarta Sans", "sans-serif"],
        sans: ["Plus Jakarta Sans", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        bengali: ["Hind Siliguri", "Noto Sans Bengali", "sans-serif"],
        editorial: ["Playfair Display", "Outfit", "Georgia", "serif"],
        serif: ["Playfair Display", "Outfit", "Georgia", "serif"],
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
