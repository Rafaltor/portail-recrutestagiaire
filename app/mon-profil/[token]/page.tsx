"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type ApiPayload = {
  profile: {
    id: string;
    handle: string;
    jobTitle: string;
    city: string | null;
    status: string;
    createdAt: string;
  };
  stats: {
    cvViews: number;
    likes: number;
    dislikes: number;
    score: number;
    likesRatio: number | null;
    hasVotes: boolean;
    rank: number | null;
    totalRanked: number;
  };
};

type HistoryPayload = {
  items: Array<{
    id: string;
    versionIndex: number;
    createdAt: string;
    handle: string;
    jobTitle: string;
    city: string | null;
    status: string;
    cvPath: string;
    likes: number;
    dislikes: number;
    score: number;
  }>;
  evolution: Array<{
    id: string;
    deltaLikes: number | null;
    deltaDislikes: number | null;
    deltaScore: number | null;
  }>;
};

const ratioLabel = (value: number | null) => {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
};

type AuthStatus = "idle" | "submitting" | "oauth" | "success" | "error";

export default function MonProfilTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isConnected = !!session?.access_token;
  const accessToken = session?.access_token || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [authMessage, setAuthMessage] = useState("");
  const [linkStatus, setLinkStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [linkError, setLinkError] = useState("");
  const [linkAttemptKey, setLinkAttemptKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [history, setHistory] = useState<HistoryPayload | null>(null);

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
    if (!authReady || !isConnected) return;
    let alive = true;
    async function loadConnectedData() {
      const bearer = accessToken;
      if (!bearer) return;
      setLoading(true);
      setError("");
      setHistoryLoading(true);
      setHistoryError("");
      setHistory(null);

      const [statsRes, historyRes] = await Promise.all([
        fetch(`/api/mon-profil/${encodeURIComponent(token)}`, { method: "GET" }),
        linkStatus === "done"
          ? fetch(`/api/mon-profil/${encodeURIComponent(token)}/history`, {
              method: "GET",
              headers: {
                authorization: `Bearer ${bearer}`,
              },
            })
          : Promise.resolve(
              new Response(JSON.stringify({ error: "token_not_linked_yet" }), {
                status: 403,
                headers: { "content-type": "application/json" },
              }),
            ),
      ]);
      if (!alive) return;

      if (statsRes.status === 404) {
        setData(null);
        setError("Token invalide ou profil introuvable.");
      } else if (!statsRes.ok) {
        const j = await statsRes.json().catch(() => ({}));
        setData(null);
        setError(j?.error || "Erreur serveur");
      } else {
        const j = (await statsRes.json()) as ApiPayload;
        setData(j);
      }
      setLoading(false);

      if (!historyRes.ok) {
        const j = await historyRes.json().catch(() => ({}));
        setHistoryError(j?.error || "Impossible de charger l'historique.");
      } else {
        const j = (await historyRes.json()) as HistoryPayload;
        setHistory(j);
      }
      setHistoryLoading(false);
    }
    void loadConnectedData();
    return () => {
      alive = false;
    };
  }, [accessToken, authReady, isConnected, token, linkStatus]);

  useEffect(() => {
    if (!isConnected || !accessToken || linkStatus === "loading") return;
    const key = `${session.user.id}:${token}`;
    if (linkAttemptKey === key) return;
    let alive = true;
    async function linkToken() {
      setLinkAttemptKey(key);
      setLinkStatus("loading");
      setLinkError("");
      const r = await fetch("/api/account/link-profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
      if (!alive) return;
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setLinkStatus("error");
        setLinkError(j?.error || "link_failed");
        return;
      }
      setLinkStatus("done");
    }
    void linkToken();
    return () => {
      alive = false;
    };
  }, [accessToken, isConnected, session?.user.id, token, linkAttemptKey, linkStatus]);

  const voteSummary = useMemo(() => {
    if (!data?.stats.hasVotes) return "Aucun vote pour le moment.";
    return `${data.stats.likes} likes / ${data.stats.dislikes} dislikes`;
  }, [data]);

  async function authenticateEmailPassword() {
    setAuthStatus("submitting");
    setAuthMessage("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthStatus("error");
      setAuthMessage("Email invalide.");
      return;
    }
    if (password.length < 6) {
      setAuthStatus("error");
      setAuthMessage("Mot de passe trop court (min 6).");
      return;
    }
    if (authMode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      if (signUpError) {
        setAuthStatus("error");
        setAuthMessage(signUpError.message);
        return;
      }
      setAuthStatus("success");
      setAuthMessage("Compte créé. Vérifie ton email pour confirmer.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (signInError) {
      setAuthStatus("error");
      setAuthMessage(signInError.message);
      return;
    }
    setAuthStatus("success");
    setAuthMessage("Connexion réussie.");
  }

  async function authenticateGoogle() {
    setAuthStatus("oauth");
    setAuthMessage("");
    const redirectTo =
      typeof window !== "undefined" ? window.location.href : undefined;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    if (oauthError) {
      setAuthStatus("error");
      setAuthMessage(oauthError.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setData(null);
    setHistory(null);
    setAuthMessage("");
    setLinkStatus("idle");
    setLinkError("");
    setLinkAttemptKey("");
  }

  if (!authReady) {
    return (
      <div className="grid gap-4 md:gap-6">
        <section className="rs-panel rounded-lg p-4 text-sm text-[#0A0A0A]/85 md:p-6">
          Chargement…
        </section>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="grid gap-4 md:gap-6">
        <section className="rs-panel rounded-lg p-4 md:p-6">
          <h1 className="text-lg font-black tracking-tight md:text-2xl">
            Mon profil (privé)
          </h1>
          <p className="mt-2 text-sm text-[#0A0A0A]/85">
            Connecte-toi ou crée un compte pour accéder à tes stats et à
            l&apos;historique de ce profil.
          </p>
          <p className="mt-1 text-xs text-[#0A0A0A]/70">
            Token détecté: <span className="font-mono">{token}</span>
          </p>
        </section>

        <section className="rs-panel rounded-lg p-4 md:p-6">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
              placeholder="toi@exemple.com"
            />
          </label>

          <label className="mt-3 grid gap-1">
            <span className="text-sm font-semibold">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                setAuthMode((m) => (m === "login" ? "signup" : "login"))
              }
              className="rs-btn rs-btn--ghost"
            >
              {authMode === "login"
                ? "Passer en inscription"
                : "Passer en connexion"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={authStatus === "submitting"}
              onClick={() => void authenticateEmailPassword()}
              className="rs-btn rs-btn--primary disabled:opacity-50"
            >
              {authStatus === "submitting"
                ? "Connexion..."
                : authMode === "login"
                  ? "Connexion email/mot de passe"
                  : "Créer mon compte"}
            </button>
            <button
              disabled={authStatus === "oauth"}
              onClick={() => void authenticateGoogle()}
              className="rs-btn rs-btn--ghost disabled:opacity-50"
            >
              {authStatus === "oauth" ? "Redirection..." : "Continuer avec Google"}
            </button>
          </div>

          {authMessage ? (
            <p
              className={`mt-3 text-sm ${
                authStatus === "error" ? "text-red-700" : "text-[#0A0A0A]/85"
              }`}
            >
              {authMessage}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-6">
      <section className="rs-panel rounded-lg p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight md:text-2xl">
              Mon profil (privé)
            </h1>
            <p className="mt-1 text-xs text-[#0A0A0A]/85 md:text-sm">
              Compte connecté:{" "}
              <span className="font-semibold">{session?.user?.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void signOut()}
              className="inline-flex w-fit rounded-md border border-[#ddd] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f5f5f5] md:text-sm"
            >
              Déconnexion
            </button>
            <Link
              href="/profils"
              className="inline-flex w-fit rounded-md border border-[#ddd] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f5f5f5] md:text-sm"
            >
              Voir le classement public
            </Link>
          </div>
        </div>
        {linkStatus === "loading" ? (
          <p className="mt-3 text-sm text-[#0A0A0A]/85">
            Rattachement du profil à ton compte…
          </p>
        ) : null}
        {linkStatus === "error" ? (
          <div className="mt-3 text-sm text-red-700">
            <p>Impossible de rattacher automatiquement le token: {linkError}</p>
            <button
              onClick={() => {
                setLinkAttemptKey("");
                setLinkStatus("idle");
                setLinkError("");
              }}
              className="mt-2 inline-flex rounded-md border border-[#ddd] bg-white px-3 py-2 text-xs font-semibold text-[#0A0A0A] hover:bg-[#f5f5f5]"
            >
              Réessayer le rattachement
            </button>
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="rs-panel rounded-lg p-4 text-sm text-[#0A0A0A]/85 md:p-6">
          Chargement des stats…
        </section>
      ) : error ? (
        <section className="rs-panel rounded-lg border border-red-200 p-4 text-sm text-red-700 md:p-6">
          {error}
        </section>
      ) : data ? (
        <>
          <section className="rs-panel rounded-lg p-4 md:p-6">
            <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]/70">
              Profil
            </p>
            <h2 className="mt-2 text-lg font-black md:text-xl">
              @{data.profile.handle.replace(/^@/, "")}
            </h2>
            <p className="mt-1 text-sm text-[#0A0A0A]/85">{data.profile.jobTitle}</p>
            <p className="mt-1 text-sm text-[#0A0A0A]/85">
              {data.profile.city ? data.profile.city : "Ville non renseignée"}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rs-panel rounded-lg p-4 md:p-5">
              <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]/70">
                Vues CV
              </p>
              <p className="mt-2 text-2xl font-black">{data.stats.cvViews}</p>
            </article>
            <article className="rs-panel rounded-lg p-4 md:p-5">
              <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]/70">
                Ratio likes
              </p>
              <p className="mt-2 text-2xl font-black">
                {ratioLabel(data.stats.likesRatio)}
              </p>
              <p className="mt-1 text-xs text-[#0A0A0A]/85">{voteSummary}</p>
            </article>
            <article className="rs-panel rounded-lg p-4 md:p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]/70">
                Classement
              </p>
              <p className="mt-2 text-2xl font-black">
                {data.stats.rank ? `#${data.stats.rank}` : "Non classé"}
              </p>
              <p className="mt-1 text-xs text-[#0A0A0A]/85">
                sur {data.stats.totalRanked} profils publiés
              </p>
            </article>
          </section>

          {!data.stats.hasVotes ? (
            <section className="rs-panel rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 md:p-6">
              Aucun vote encore. Partage ton profil pour lancer les votes.
            </section>
          ) : null}

          <section className="rs-panel rounded-lg p-4 md:p-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#0A0A0A]/85">
              Historique & évolutions
            </h3>
            {historyLoading ? (
              <p className="mt-3 text-sm text-[#0A0A0A]/85">
                Chargement de l&apos;historique…
              </p>
            ) : historyError ? (
              <p className="mt-3 text-sm text-red-700">{historyError}</p>
            ) : history?.items?.length ? (
              <div className="mt-3 grid gap-3">
                {history.items.map((item) => {
                  const evo = history.evolution.find((e) => e.id === item.id) ?? null;
                  return (
                    <article
                      key={item.id}
                      className="rounded-md border border-[#ddd] bg-white p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">
                          Version {item.versionIndex} —{" "}
                          {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                        <div className="text-xs text-[#0A0A0A]/70">score {item.score}</div>
                      </div>
                      <div className="mt-1 text-xs text-[#0A0A0A]/85">
                        {item.likes} likes / {item.dislikes} dislikes
                        {evo
                          ? ` · Δ likes ${evo.deltaLikes ?? "—"} · Δ dislikes ${evo.deltaDislikes ?? "—"} · Δ score ${evo.deltaScore ?? "—"}`
                          : ""}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#0A0A0A]/85">
                Aucune version historique disponible.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
