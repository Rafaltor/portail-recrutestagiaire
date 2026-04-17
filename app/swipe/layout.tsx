import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Voter pour les meilleurs CV créatifs — Recrute Stagiaire",
  description:
    "Swipe les CVs créatifs déposés par la communauté. Vote pour tes favoris et gagne des réductions sur la boutique.",
  path: "/swipe",
});

export default function SwipeLayout({ children }: { children: ReactNode }) {
  return children;
}
