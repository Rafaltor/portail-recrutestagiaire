import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recrute Stagiaire — Portail",
    short_name: "Recrute Stagiaire",
    description:
      "Dépose ton CV créatif, la communauté vote, les meilleurs profils rejoignent le collectif.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#f472b6",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
