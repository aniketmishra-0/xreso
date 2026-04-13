/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        xr: {
          bg: "#1A122A",
          bgDeep: "#120D1F",
          surface: "#201731",
          surfaceElev: "#281D3E",
          purple: "#8B5CF6",
          purpleBright: "#A78BFA",
          orange: "#F97316",
          orangeBright: "#FB923C",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(120deg, #8B5CF6 0%, #F97316 100%)",
        "radial-brand": "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.35), rgba(249,115,22,0.25) 45%, transparent 75%)",
        "mesh-dark": "radial-gradient(at 20% 20%, rgba(139,92,246,0.18), transparent 45%), radial-gradient(at 80% 10%, rgba(249,115,22,0.18), transparent 45%), linear-gradient(180deg, #1A122A, #120D1F)",
      },
      boxShadow: {
        glass: "0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        glowPurple: "0 0 0 1px rgba(139,92,246,0.35), 0 8px 30px rgba(139,92,246,0.25)",
        glowOrange: "0 0 0 1px rgba(249,115,22,0.35), 0 8px 30px rgba(249,115,22,0.25)",
        glowBrand: "0 0 0 1px rgba(139,92,246,0.35), 0 6px 24px rgba(139,92,246,0.2), 0 10px 30px rgba(249,115,22,0.2)",
      },
      borderColor: {
        subtle: "rgba(255,255,255,0.12)",
      },
      keyframes: {
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "float-slow": "floatSlow 6s ease-in-out infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
