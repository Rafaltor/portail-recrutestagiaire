import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Profils créatifs — Les plus likés par la communauté · Recrute Stagiaire",
  description:
    "Les profils les plus likés par la communauté. CV créatifs, mode, textile — vote et découvre les candidats.",
  path: "/profils",
});

export default function ProfilsLayout({ children }: { children: ReactNode }) {
  return children;
}
