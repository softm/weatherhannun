module.exports = {
  theme: {
    extend: {
      colors: {
        background: "#F0F6FC",
        "surface-bright": "#FFFFFF",
        "surface": "#F4F8FD",
        "surface-container": "#FFFFFF",
        "on-background": "#0F1B2D",
        "on-surface": "#0F1B2D",
        "on-surface-variant": "#64748B",
        "on-surface-subtle": "#94A3B8",
        primary: "#1D75F0",
        "primary-light": "#EBF3FE",
        secondary: "#2589F5",
        "recommend-positive": "#10B981",
        "alert-warning": "#F59E0B",
        "alert-heat": "#EA580C",
        "alert-danger": "#EF4444",
        "sky-day": "#2589F5",
        "sky-day-light": "#D8EEFF",
        "weather-rain": "#3B82F6",
        outline: "#E2E8F0"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.875rem",
        "2xl": "1.25rem",
        "full": "9999px"
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.25rem",
        "space-xl": "2rem",
        "margin": "1rem"
      },
      fontFamily: {
        "tabular-metric": ["Inter", "sans-serif"],
        "display-mobile": ["Space Grotesk", "Inter", "sans-serif"],
        "headline-lg-mobile": ["Space Grotesk", "Inter", "sans-serif"],
        "headline-sm": ["Inter", "sans-serif"],
        "title-md": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "label-lg": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"]
      },
      fontSize: {
        "label-sm": ["11px", { "lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500" }],
        "tabular-metric": ["20px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "title-md": ["16px", { "lineHeight": "22px", "fontWeight": "600" }],
        "headline-md": ["22px", { "lineHeight": "28px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "label-lg": ["13px", { "lineHeight": "16px", "letterSpacing": "0.01em", "fontWeight": "600" }],
        "headline-sm": ["18px", { "lineHeight": "24px", "fontWeight": "600" }],
        "display-mobile": ["64px", { "lineHeight": "68px", "letterSpacing": "-0.03em", "fontWeight": "600" }],
        "headline-lg-mobile": ["28px", { "lineHeight": "34px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "body-md": ["14px", { "lineHeight": "21px", "fontWeight": "400" }],
        "body-sm": ["12px", { "lineHeight": "16px", "fontWeight": "400" }]
      }
    }
  }
};
module.exports.important="#stitch-live-dashboard";
module.exports.content=["./stitch-today.template.html","./stitch-today.js"];