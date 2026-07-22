import React from "react";

// Thin-stroke line icons (feather-style), all currentColor so they inherit
// the theme (ink / bronze / muted) from their parent. These replace every
// emoji in the UI — the marble design speaks in engraved lines, not pictographs.
const Ic = ({ size = 16, children, fill = "none", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}>
    {children}
  </svg>
);

export const IcFlame = (p) => (
  <Ic {...p}><path d="M12 22c4.4 0 7-2.8 7-6.7 0-3-1.9-5.2-3.4-6.8C14.3 7 13.2 4.7 12.6 2c-1 2.8-2.2 4.3-3.7 5.8C7.2 9.5 5 11.6 5 15.3 5 19.2 7.6 22 12 22z" /><path d="M12 22c2 0 3.3-1.4 3.3-3.3 0-1.7-1-2.8-1.9-3.9-.5.9-1 1.4-1.9 2-.8.6-1.8 1.3-1.8 2.6C9.7 20.9 10.6 22 12 22z" /></Ic>
);
export const IcMoon = (p) => (
  <Ic {...p}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></Ic>
);
export const IcTrendUp = (p) => (
  <Ic {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Ic>
);
export const IcAlert = (p) => (
  <Ic {...p}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Ic>
);
export const IcMeal = (p) => (
  <Ic {...p}><path d="M4 3v8a3 3 0 003 3v7" /><path d="M10 3v8a3 3 0 01-3 3" /><path d="M18 3c-1.6 0-3 1.6-3 5s1.4 5 3 5v8" /></Ic>
);
export const IcChart = (p) => (
  <Ic {...p}><path d="M3 3v18h18" /><path d="M7.5 14v3.5" /><path d="M12 10v7.5" /><path d="M16.5 6v11.5" /></Ic>
);
export const IcBall = (p) => (
  <Ic {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8l3.8 2.8-1.4 4.4H9.6L8.2 10.8z" /><path d="M12 3v5M4.7 7.5l3.5 3.3M19.3 7.5l-3.5 3.3M7 20l2.6-4.8M17 20l-2.6-4.8" /></Ic>
);
export const IcDrop = (p) => (
  <Ic {...p}><path d="M12 2.7s6.4 6.9 6.4 11.2a6.4 6.4 0 01-12.8 0C5.6 9.6 12 2.7 12 2.7z" /></Ic>
);
export const IcChat = (p) => (
  <Ic {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Ic>
);
export const IcPulse = (p) => (
  <Ic {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Ic>
);
export const IcBandage = (p) => (
  <Ic {...p}><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M10.6 10.6h.01M13.4 10.6h.01M10.6 13.4h.01M13.4 13.4h.01" /></Ic>
);
export const IcDumbbell = (p) => (
  <Ic {...p}><path d="M6.5 6.5v11M17.5 6.5v11" /><path d="M3.5 9v6M20.5 9v6" /><path d="M6.5 12h11" /></Ic>
);
export const IcCalendar = (p) => (
  <Ic {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></Ic>
);
export const IcTrash = (p) => (
  <Ic {...p}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></Ic>
);
export const IcTrophy = (p) => (
  <Ic {...p}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4.5a5 5 0 01-10 0z" /><path d="M7 6H4.5a2 2 0 001.6 3.9L7 10M17 6h2.5a2 2 0 01-1.6 3.9L17 10" /></Ic>
);
export const IcBolt = (p) => (
  <Ic {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></Ic>
);
export const IcHeart = (p) => (
  <Ic {...p}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z" /></Ic>
);
export const IcJump = (p) => (
  <Ic {...p}><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></Ic>
);
export const IcPencil = (p) => (
  <Ic {...p}><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Ic>
);
export const IcGauge = (p) => (
  <Ic {...p}><circle cx="12" cy="12" r="9" /><path d="M12 12l3.5-3.5" /><path d="M12 12h.01" /></Ic>
);
export const IcBlock = (p) => (
  <Ic {...p}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></Ic>
);
