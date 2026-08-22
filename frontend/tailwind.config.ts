
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["Geist Variable", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.02)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.03)",
        "card-dark": "0 1px 3px 0 rgb(0 0 0 / 0.15), 0 0 0 1px rgb(255 255 255 / 0.03)",
        "card-dark-hover": "0 4px 6px -1px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(255 255 255 / 0.04)",
        "glow-primary": "0 0 20px -4px hsl(var(--primary) / 0.25)",
        "glow-success": "0 0 20px -4px hsl(var(--success) / 0.25)",
        "glow-danger": "0 0 20px -4px hsl(var(--danger) / 0.25)",
        "glow-warning": "0 0 20px -4px hsl(var(--warning) / 0.25)",
        "inner-light": "inset 0 1px 0 0 rgb(255 255 255 / 0.6)",
        "inner-dark": "inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
      },
      transitionTimingFunction: {
        "premium": "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mesh-light": "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(40 30% 96%), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, hsl(35 40% 95%), transparent)",
        "mesh-dark": "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(220 30% 12%), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, hsl(220 25% 10%), transparent)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
