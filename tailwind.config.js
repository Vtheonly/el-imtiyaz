/**
 * Tailwind CSS configuration — El-Imtiyaz desktop.
 *
 * IMPORTANT: This file is intentionally NOT in .gitignore at the project
 * level. The root repo's .gitignore previously excluded `tailwind.config.js`
 * and `postcss.config.js`, which caused the CSS pipeline to silently
 * produce a 3.36 kB stylesheet (just the @tailwind directives left
 * unprocessed) instead of the expected ~30 kB of compiled utility classes.
 * The result was a "pure HTML, no design" rendering. Iteration 4 fix.
 *
 * Design tokens come from src/index.css (CSS variables) and mirror the
 * Android Color.kt palette per business plan §03.
 */
/// <reference types="vitest" />
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // shadcn/ui standard tokens — mapped to CSS variables in index.css
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

        // Brand palette (plan §03.01) — raw hex, used as accent colors
        brand: {
          blue: "var(--brand-blue)",
          "blue-deep": "var(--brand-blue-deep)",
          "blue-light": "var(--brand-blue-light)",
          cyan: "var(--brand-cyan)",
          slate: "var(--brand-slate)",
          brown: "var(--brand-brown)",
          gold: "var(--brand-gold)",
        },

        // Status palette — semantic colors used across StatusChip, KpiCard, etc.
        status: {
          success: "var(--status-success)",
          warning: "var(--status-warning)",
          danger: "var(--status-danger)",
          info: "var(--status-info)",
          neutral: "var(--status-neutral)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "9999px",
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Arabic"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
        arabic: ['"Noto Sans Arabic"', '"Inter"', "sans-serif"],
      },
      keyframes: {
        // Animations used by Radix UI primitives + UnifiedModal
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "zoom-in-95": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "zoom-out-95": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.15s ease-in",
        "zoom-in-95": "zoom-in-95 0.2s ease-out",
        "zoom-out-95": "zoom-out-95 0.15s ease-in",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-out-right": "slide-out-right 0.2s ease-in",
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [animate],
};
