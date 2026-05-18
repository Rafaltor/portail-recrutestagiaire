import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const alt = "Recrute Stagiaire — Portail candidature créative";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoPath = path.join(process.cwd(), "public/rs-logo-eu.png");
  const logo = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #0a0a0a 0%, #141414 42%, #3b1530 100%)",
          color: "#ffffff",
          fontFamily:
            'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          padding: 72,
        }}
      >
        <img
          src={logoSrc}
          width={200}
          height={200}
          alt=""
          style={{ objectFit: "contain" }}
        />
        <div
          style={{
            marginTop: 36,
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Recrute Stagiaire
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 30,
            fontWeight: 500,
            color: "#f472b6",
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Portail · Dépose ton CV · La communauté vote
        </div>
        </div>
    ),
    { ...size },
  );
}
