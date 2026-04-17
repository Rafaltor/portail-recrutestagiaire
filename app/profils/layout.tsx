import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Profils créatifs — Classement communautaire · Recrute Stagiaire",
  description:
    "Découvre les CVs créatifs les plus likés par la communauté. Mode, textile, DA, communication — tous les profils créatifs parisiens.",
  path: "/profils",
});

export default function ProfilsLayout({ children }: { children: ReactNode }) {
  return children;
}
