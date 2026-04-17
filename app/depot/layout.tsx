import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Déposer son CV créatif — Stage mode Paris · Recrute Stagiaire",
  description:
    "Dépose ton CV créatif en PDF, la communauté vote pour toi. Les plus likés rejoignent le collectif Recrute Stagiaire Paris.",
  path: "/depot",
});

export default function DepotLayout({ children }: { children: ReactNode }) {
  return children;
}
