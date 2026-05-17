import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleTouchIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f472b6",
          borderRadius: 40,
          color: "#ffffff",
          fontSize: 72,
          fontWeight: 800,
          fontFamily:
            'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          letterSpacing: "-0.04em",
        }}
      >
        RS
      </div>
    ),
    { ...size },
  );
}

