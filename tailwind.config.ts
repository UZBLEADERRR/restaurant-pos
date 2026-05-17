import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kakao: {
          yellow: "#FEE500",
          "yellow-dark": "#F5D800",
          brown: "#3C1E1E",
          dark: "#111111",
          gray: "#F7F7F7",
          "gray-2": "#EBEBEB",
          "gray-3": "#9E9E9E",
          "gray-4": "#616161",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans KR",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
