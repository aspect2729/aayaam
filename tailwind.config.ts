import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        ink: "#0B0B10",
        secondary: "#5A6274",
        muted: "#8A93A6",
        line: "#E7EBF5",
        surface: "#FFFFFF",
        accent: {
          DEFAULT: "#6D4AFF",
          light: "#C4B5FD",
          tint: "#F3EEFF",
        },
        chip: {
          blue: { DEFAULT: "#E7EDFC", border: "#9DB4F1", ink: "#23408F" },
          sand: { DEFAULT: "#F4ECDD", border: "#DCC59B", ink: "#6B5226" },
          lavender: { DEFAULT: "#EFE8FC", border: "#B89DEB", ink: "#4C2C8C" },
          mint: { DEFAULT: "#E4F4E9", border: "#8DCBA2", ink: "#1F5C35" },
          rose: { DEFAULT: "#FDECEC", border: "#F0A8A8", ink: "#8E2424" },
        },
      },
      borderRadius: {
        card: "20px",
        inner: "12px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(24, 16, 48, 0.05)",
        cardHover: "0 16px 40px rgba(24, 16, 48, 0.08)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 200ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
