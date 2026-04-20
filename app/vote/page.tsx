import { redirect } from "next/navigation";

/** Même URL que le thème Shopify (`menu_cand_3` par défaut → portail …/vote). */
export default function VoteAliasPage() {
  redirect("/swipe");
}
