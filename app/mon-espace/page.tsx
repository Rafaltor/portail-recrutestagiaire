"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  AUTH_LIKES_PER_DAY,
  dayKeyUTC,
  getLikesDayKey,
  readLocalInt,
} from "@/lib/swipe-gating";
import type { Session } from "@supabase/supabase-js";

type MonEspaceData = {
  user: {
    id: string;
    email: string;
  };
  role: "candidate" | "voter";
  candidate: null | {
    id: string;
    token: string;
    handle: string;
    jobTitle: string;
    city: string | null;
    status: string;
    createdAt: string;
    stats: {
      cvViews: number;
      likes: number;
      dislikes: number;
      score: number;
      likesRatio: number | null;
      rank: number | null;
      totalRanked: number;
    };
  };
  candidateHistory: Array<{
    id: string;
    createdAt: string;
    handle: string;
    jobTitle: string;
    status: string;
    likes: number;
    dislikes: number;
    score: number;
    cvPath: string;
    token: string;
  }>;
  voter: {
    linkedVisitorIdsCount: number;
    totalVotes: number;
    likesGiven: number;
    dislikesGiven: number;
    uniqueProfilesLiked: number;
    uniqueProfilesDisliked: number;
    rewardProgress: {
      unlocked: boolean;
      nextMilestoneLikes: number;
      currentLikes: number;
    };
  };
  links: {
    monProfil: string | null;
  };
};

const ratioLabel = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

function MonEspaceLoginInline() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState<"idle" | "loading" | "oauth" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submitEmailPassword() {
    setStatus("loading");
    setMessage("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setStatus("error");
      setMessage("Email invalide.");
      return;
    }
    if (password.length < 6) {
      setStatus("error");
      setMessage("Mot de passe trop court (min 6).");
      return;
    }
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/mon-espace`
              : undefined,
        },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("idle");
      setMessage("Compte créé. Vérifie ton email pour confirmer.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("idle");
    setMessage("Connexion réussie.");
  }

  async function submitGoogle() {
    setStatus("oauth");
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/mon-espace`
            : undefined,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <section className="rs-panel rounded-lg p-6">
      <h1 className="text-xl font-black tracking-tight">Mon espace</h1>
      <p className="mt-2 text-sm text-zinc-700">
        Connecte-toi pour afficher ton espace candidat/votant.
      </p>

      <label className="mt-4 grid gap-1">
        <span className="text-sm font-semibold">Email</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="toi@exemple.com"
        />
      </label>

      <label className="mt-3 grid gap-1">
        <span className="text-sm font-semibold">Mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="••••••••"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="rs-btn rs-btn--ghost"
        >
          {mode === "login" ? "Passer en inscription" : "Passer en connexion"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          disabled={status === "loading"}
          onClick={() => void submitEmailPassword()}
          className="rs-btn rs-btn--primary disabled:opacity-50"
        >
          {status === "loading"
            ? "Connexion..."
            : mode === "login"
              ? "Connexion email/mot de passe"
              : "Créer mon compte"}
        </button>
        <button
          disabled={status === "oauth"}
          onClick={() => void submitGoogle()}
          className="rs-btn rs-btn--ghost disabled:opacity-50"
        >
          {status === "oauth" ? "Redirection..." : "Continuer avec Google"}
        </button>
      </div>

      {message ? (
        <p
          className={`mt-3 text-sm ${
            status === "error" ? "text-red-700" : "text-zinc-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

export default function MonEspacePage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MonEspaceData | null>(null);
  const [linkingVisitor, setLinkingVisitor] = useState(false);
  const [visitorMessage, setVisitorMessage] = useState("");

  const isConnected = !!session?.access_token;
  const accessToken = session?.access_token || "";
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const effectiveData = isConnected ? data : null;
  const effectiveError = isConnected ? error : "";
  const likesLeftToday = useMemo(() => {
    if (!isConnected) return null;
    const key = getLikesDayKey(visitorId, dayKeyUTC());
    const used = readLocalInt(key);
    return Math.max(0, AUTH_LIKES_PER_DAY - used);
  }, [isConnected, visitorId]);

  useEffect(() => {
    let alive = true;
    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    }
    void bootstrapAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !accessToken) return;
    let alive = true;
    async function linkVisitor() {
      setLinkingVisitor(true);
      setVisitorMessage("");
      const r = await fetch("/api/account/link-visitor", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ visitorId }),
      });
      if (!alive) return;
      setLinkingVisitor(false);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setVisitorMessage(j?.error || "visitor_link_failed");
        return;
      }
      setVisitorMessage("Identité votant liée au compte.");
      const rr = await fetch("/api/mon-espace", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      if (rr.ok) {
        const jj = (await rr.json()) as MonEspaceData;
        if (!alive) return;
        setData(jj);
      }
    }
    void linkVisitor();
    return () => {
      alive = false;
    };
  }, [isConnected, accessToken, visitorId]);

  useEffect(() => {
    if (!isConnected || !accessToken) return;
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      const r = await fetch("/api/mon-espace", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      if (!alive) return;
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error || "Impossible de charger mon espace.");
        setData(null);
        setLoading(false);
        return;
      }
      const j = (await r.json()) as MonEspaceData;
      if (!alive) return;
      setData(j);
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [isConnected, accessToken]);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setData(null);
    setError("");
  }

  if (!authReady) {
    return (
      <div className="grid gap-6">
        <section className="rs-panel rounded-lg p-6 text-sm text-zinc-700">
          Chargement…
        </section>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="grid gap-6">
        <MonEspaceLoginInline />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rs-panel rounded-lg p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">Mon espace</h1>
            <p className="mt-1 text-sm text-zinc-700">
              Connecté en tant que{" "}
              <span className="font-semibold">{session?.user?.email}</span>
            </p>
          </div>
          <button
            onClick={() => void signOut()}
            className="inline-flex w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
          >
            Déconnexion
          </button>
        </div>
        <div className="mt-3 text-xs text-zinc-600">
          {linkingVisitor ? "Liaison votant..." : visitorMessage}
        </div>
      </section>

      {loading ? (
        <section className="rs-panel rounded-lg p-6 text-sm text-zinc-700">
          Chargement des données…
        </section>
      ) : effectiveError ? (
        <section className="rs-panel rounded-lg border border-red-200 p-6 text-sm text-red-700">
          {effectiveError}
        </section>
      ) : effectiveData ? (
        <>
          {effectiveData.candidate ? (
            <>
              <section className="rs-panel rounded-lg p-6">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                  Espace candidat
                </p>
                <h2 className="mt-2 text-lg font-black">
                  @{effectiveData.candidate.handle.replace(/^@/, "")}
                </h2>
                <p className="mt-1 text-sm text-zinc-700">
                  {effectiveData.candidate.jobTitle}
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rs-panel rounded-lg p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Vues CV
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {effectiveData.candidate.stats.cvViews}
                  </p>
                </article>
                <article className="rs-panel rounded-lg p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Likes
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {effectiveData.candidate.stats.likes}
                  </p>
                </article>
                <article className="rs-panel rounded-lg p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Dislikes
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {effectiveData.candidate.stats.dislikes}
                  </p>
                </article>
                <article className="rs-panel rounded-lg p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Rang
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {effectiveData.candidate.stats.rank
                      ? `#${effectiveData.candidate.stats.rank}`
                      : "Non classé"}
                  </p>
                </article>
              </section>

              <section className="rs-panel rounded-lg p-6">
                <div className="text-sm text-zinc-700">
                  Ratio likes:{" "}
                  <span className="font-semibold">
                    {ratioLabel(effectiveData.candidate.stats.likesRatio)}
                  </span>
                </div>
                {effectiveData.links.monProfil ? (
                  <a
                    href={effectiveData.links.monProfil}
                    className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                  >
                    Ouvrir mon profil token
                  </a>
                ) : null}
              </section>

              <section className="rs-panel rounded-lg p-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700">
                  Historique des versions
                </h3>
                {effectiveData.candidateHistory.length ? (
                  <div className="mt-3 grid gap-3">
                    {effectiveData.candidateHistory.map((h, i) => (
                      <article
                        key={h.id}
                        className="rounded-md border border-zinc-200 bg-white p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">
                            Version {effectiveData.candidateHistory.length - i} —{" "}
                            {new Date(h.createdAt).toLocaleDateString("fr-FR")}
                          </div>
                          <div className="text-xs text-zinc-600">{h.status}</div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-700">
                          {h.likes} likes / {h.dislikes} dislikes · score {h.score}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-700">
                    Aucune version disponible.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="rs-panel rounded-lg p-6">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                Espace votant
              </p>
              <h2 className="mt-2 text-lg font-black">Tes stats de vote</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Votes totaux
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {effectiveData.voter.totalVotes}
                  </div>
                </article>
                <article className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Likes donnés
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {effectiveData.voter.likesGiven}
                  </div>
                </article>
                <article className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Profils likés
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {effectiveData.voter.uniqueProfilesLiked}
                  </div>
                </article>
                <article className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-600">
                    Récompense
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {effectiveData.voter.rewardProgress.unlocked
                      ? "Débloquée"
                      : `${effectiveData.voter.rewardProgress.currentLikes}/${effectiveData.voter.rewardProgress.nextMilestoneLikes}`}
                  </div>
                </article>
              </div>
              <p className="mt-3 text-xs text-zinc-700">
                Likes restants aujourd&apos;hui:{" "}
                <span className="font-semibold">
                  {likesLeftToday ?? AUTH_LIKES_PER_DAY}
                </span>
                /{AUTH_LIKES_PER_DAY}
              </p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
