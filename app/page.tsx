export default function Home() {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black tracking-tight">Portail candidatures</h1>
        <p className="mt-2 max-w-2xl text-zinc-700">
          MVP : dépôt de CV (PDF), affichage des profils publiés et votes (like /
          dislike) sans compte via un identifiant visiteur.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            href="/profils"
          >
            Voir les profils
          </a>
          <a
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            href="/depot"
          >
            Déposer un profil
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
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
