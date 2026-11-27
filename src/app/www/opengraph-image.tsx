import { ImageResponse } from "next/og";

// The card shown when the main site is shared.
export const alt = "Weddings Weddings: your whole wedding, at your own address";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f1ec",
          color: "#1d2a21",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#4c6b52" }}>
          Weddings Weddings
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.04 }}>
          <span>Your whole wedding,</span>
          <span style={{ fontStyle: "italic", color: "#4c6b52" }}>at your own address.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30 }}>
          <div
            style={{
              display: "flex",
              background: "#fff",
              borderRadius: 999,
              padding: "14px 28px",
              border: "1px solid rgba(35,37,32,0.12)",
            }}
          >
            <span style={{ fontWeight: 700 }}>jonsarah</span>
            <span style={{ color: "#5b5a52" }}>.weddingsweddings.co.uk</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {["#4c6b52", "#a8475a", "#86641a", "#4f5d94", "#2b6c70", "#7a4f86"].map((c) => (
              <div key={c} style={{ width: 26, height: 26, borderRadius: 999, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
