import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Connexion — Recrute Stagiaire",
  description:
    "Connecte-toi à ton espace Recrute Stagiaire pour gérer ton profil, suivre tes votes et accéder aux récompenses du collectif.",
  path: "/connexion",
});

export default function ConnexionLayout({ children }: { children: ReactNode }) {
  return children;
}
