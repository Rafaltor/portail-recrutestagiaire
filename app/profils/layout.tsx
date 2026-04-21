import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Profils créatifs — Les meilleurs profils de ta région · Recrute Stagiaire",
  description:
    "Les meilleurs profils de ta région. CV créatifs, mode, textile — la communauté vote.",
  path: "/profils",
});

export default function ProfilsLayout({ children }: { children: ReactNode }) {
  return children;
}
