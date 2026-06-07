import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        arena: {
          bg: "#0E0E0F",
          surface: "#161618",
          elevated: "#1E1E21",
          border: "#2A2A2E",
          "border-strong": "#3E3E44",
          "text-primary": "#F0EFE9",
          "text-secondary": "#8A8A96",
          "text-muted": "#52525C",
          accent: "#6E7FD4",
          "accent-dim": "#5563B8",
          "accent-subtle": "#6E7FD41A",
          success: "#22C55E",
          "success-subtle": "#22C55E1A",
          danger: "#EF4444",
          "danger-subtle": "#EF44441A",
          warning: "#B8956B",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "5px",
        md: "8px",
        lg: "12px",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        feedIn: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        waitingDot: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.3)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        feedIn: "feedIn 0.15s ease-out",
        waitingDot: "waitingDot 2s infinite",
      },
    },
  },
};

export default config;
