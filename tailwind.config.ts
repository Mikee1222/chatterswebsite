import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 5%)",
        foreground: "hsl(0 0% 98%)",
        card: "hsl(0 0% 8%)",
        "card-foreground": "hsl(0 0% 98%)",
        primary: {
          DEFAULT: "hsl(330 80% 55%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: "hsl(0 0% 12%)",
        muted: "hsl(0 0% 15%)",
        "muted-foreground": "hsl(0 0% 65%)",
        accent: "hsl(330 60% 45%)",
        border: "hsl(0 0% 18%)",
        ring: "hsl(330 70% 55%)",
        glass: "rgba(255,255,255,0.06)",
        "glass-border": "rgba(255,255,255,0.08)",
        pink: {
          glow: "hsl(330 80% 55% / 0.25)",
          soft: "hsl(330 60% 50%)",
          bright: "hsl(330 90% 60%)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
        glass: "12px",
        "glass-strong": "24px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0,0,0,0.2)",
        "pink-glow": "0 0 20px -5px hsl(330 80% 55% / 0.4)",
        "pink-soft": "0 0 40px -10px hsl(330 80% 55% / 0.2)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
