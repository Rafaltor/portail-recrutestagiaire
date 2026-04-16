import type { Viewport } from "next";

// Accueil volontairement "desktop sur mobile" (effet dézoom rétro)
export const viewport: Viewport = {
  width: 1180,
  viewportFit: "cover",
};

export default function Home() {
  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <h1 className="text-2xl font-black tracking-tight">Portail candidatures</h1>
        <p className="mt-2 max-w-2xl text-zinc-700">
          MVP : dépôt de CV (PDF), affichage des profils publiés et votes (like /
          dislike) sans compte via un identifiant visiteur.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="rs-btn rs-btn--primary"
            href="/profils"
          >
            Voir les profils
          </a>
          <a
            className="rs-btn rs-btn--ghost"
            href="/depot"
          >
            Déposer un profil
          </a>
        </div>
      </div>

      <div className="rs-panel rounded-lg p-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800">
          Règle
        </h2>
        <p className="mt-2 text-zinc-700">
          Pas de photo de profil. CV en PDF, pseudo Instagram recommandé.
        </p>
      </div>
    </div>
  );
}
