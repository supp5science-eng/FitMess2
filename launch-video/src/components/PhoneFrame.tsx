import React from "react";
import { theme } from "../theme";

/**
 * A clean phone shell for showcasing app screens. FitMess is a phone-only PWA,
 * so almost every product shot lives inside this frame. Children render on the
 * dark app surface; a notch, status bar and bottom nav complete the illusion.
 */
export const PhoneFrame: React.FC<{
  width?: number;
  children?: React.ReactNode;
  /** which bottom-nav tab glows as active. */
  activeTab?: number;
  time?: string;
}> = ({ width = 380, children, activeTab = 0, time = "9:41" }) => {
  const height = width * 2.03;
  const bezel = width * 0.03;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: theme.radius.phone,
        background: "#000",
        padding: bezel,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px ${theme.color.border}, inset 0 0 0 1.5px #2a3234`,
        position: "relative",
      }}
    >
      {/* screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: theme.radius.phone - bezel,
          background: theme.color.bg,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 26px 6px",
            color: theme.color.fg,
            fontSize: width * 0.042,
            fontWeight: 600,
          }}
        >
          <span>{time}</span>
          <span style={{ letterSpacing: 2, opacity: 0.8 }}>●●● ▪</span>
        </div>

        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.3,
            height: width * 0.075,
            borderRadius: 999,
            background: "#000",
          }}
        />

        {/* content */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>

        <BottomNav activeTab={activeTab} width={width} />
      </div>
    </div>
  );
};

const NAV = ["Danas", "Analitika", "Dodaj", "Agent", "Profil"];

const BottomNav: React.FC<{ activeTab: number; width: number }> = ({ activeTab, width }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: "12px 8px 22px",
      borderTop: `1px solid ${theme.color.border}`,
      background: theme.color.bgSoft,
    }}
  >
    {NAV.map((label, i) => {
      const active = i === activeTab;
      return (
        <div
          key={label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            opacity: active ? 1 : 0.42,
          }}
        >
          <div
            style={{
              width: width * 0.058,
              height: width * 0.058,
              borderRadius: 8,
              background: active ? theme.color.brand : theme.color.faint,
              boxShadow: active ? `0 0 14px ${theme.color.brand}88` : "none",
            }}
          />
          <span
            style={{
              fontSize: width * 0.03,
              fontWeight: 600,
              color: active ? theme.color.brand : theme.color.faint,
            }}
          >
            {label}
          </span>
        </div>
      );
    })}
  </div>
);
