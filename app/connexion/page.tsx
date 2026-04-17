"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LinkRes = { ok: true; shopifyCustomerId: string };

function ConnexionPageInner() {
  const searchParams = useSearchParams();
  const linkToken = String(searchParams.get("token") || "").trim();
  const profileUrlParam = String(searchParams.get("profileUrl") || "").trim();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState<
    | "idle"
    | "sending"
    | "sent"
    | "linking"
    | "error"
    | "linked"
    | "authing"
    | "oauth"
    | "token-linking"
    | "token-linked"
  >("idle");
  const [message, setMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [shopifyCustomerId, setShopifyCustomerId] = useState<string | null>(
    null,
  );

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/connexion`;
  }, []);
  const authReturnUrl = useMemo(() => {
    if (!redirectTo) return "";
    const u = new URL(redirectTo);
    if (linkToken) u.searchParams.set("token", linkToken);
    if (profileUrlParam) u.searchParams.set("profileUrl", profileUrlParam);
    return u.toString();
  }, [redirectTo, linkToken, profileUrlParam]);

  async function linkTokenToCurrentUser(rawToken: string) {
    const token = rawToken.trim();
    if (!token) return;
    setStatus("token-linking");
    setMessage("");
    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();
    if (sessErr || !session?.access_token) {
      setStatus("error");
      setMessage("Session manquante. Reconnecte-toi.");
      return;
    }
    const r = await fetch("/api/account/link-profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setStatus("error");
      setMessage(j?.error || "Impossible de rattacher le profil.");
      return;
    }
    setStatus("token-linked");
    setMessage("Profil rattaché au compte avec succès.");
  }

  useEffect(() => {
    let alive = true;
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) return;
      setUserEmail(data.user?.email ?? "");
      if (data.user?.email && linkToken) {
        await linkTokenToCurrentUser(linkToken);
      }
    }
    void loadUser();
    return () => {
      alive = false;
    };
  }, [linkToken]);

  async function authWithEmailPassword() {
    setStatus("authing");
    setMessage("");
    const clean = email.trim();
    if (!clean || !clean.includes("@")) {
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
        email: clean,
        password,
        options: {
          emailRedirectTo: authReturnUrl || redirectTo || undefined,
        },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("sent");
      setMessage("Compte créé. Vérifie ton email pour confirmer.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: clean,
      password,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUserEmail(data.user?.email ?? "");
    if (linkToken) {
      await linkTokenToCurrentUser(linkToken);
      return;
    }
    setStatus("idle");
    setMessage("Connexion réussie.");
  }

  async function authWithGoogle() {
    setStatus("oauth");
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authReturnUrl || redirectTo,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function sendMagicLink() {
    setStatus("sending");
    setMessage("");
    const clean = email.trim();
    if (!clean || !clean.includes("@")) {
      setStatus("error");
      setMessage("Email invalide.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo:
          authReturnUrl || redirectTo || `${window.location.origin}/connexion`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Un email de connexion vient d’être envoyé.");
  }

  async function linkShopify() {
    setStatus("linking");
    setMessage("");

    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();

    if (sessErr || !session?.access_token) {
      setStatus("error");
      setMessage("Session manquante. Reconnecte-toi.");
      return;
    }

    const r = await fetch("/api/account/link-shopify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setStatus("error");
      if (j?.error === "shopify_customer_not_found") {
        setMessage(
          "Aucun compte client Shopify trouvé pour cet email. (On peut activer la création automatique si tu veux.)",
        );
      } else {
        setMessage(j?.error || "Impossible de lier le compte Shopify.");
      }
      return;
    }

    const j = (await r.json()) as LinkRes;
    setShopifyCustomerId(j.shopifyCustomerId);
    setStatus("linked");
    setMessage("Compte Shopify lié. (Pour les promos : on pourra l’activer plus tard.)");
  }

  async function signOut() {
    setStatus("idle");
    setMessage("");
    setShopifyCustomerId(null);
    await supabase.auth.signOut();
    setUserEmail("");
  }

  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <h1 className="text-xl font-black tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Connexion rapide (email) pour lier ton compte au portail.
        </p>
      </div>

      <div className="rs-panel rounded-lg p-6">
        {userEmail ? (
          <>
            <div className="text-sm text-zinc-700">
              Connecté en tant que <span className="font-semibold">{userEmail}</span>
            </div>
            {linkToken ? (
              <div className="mt-2 text-xs text-zinc-700">
                Token détecté: <span className="font-mono">{linkToken}</span>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                disabled={status === "linking"}
                onClick={() => void linkShopify()}
                className="rs-btn rs-btn--primary disabled:opacity-50"
              >
                {status === "linking" ? "Liaison..." : "Lier Shopify"}
              </button>

              <button
                onClick={() => void signOut()}
                className="rs-btn rs-btn--ghost"
              >
                Déconnexion
              </button>
            </div>
            {profileUrlParam ? (
              <div className="mt-4">
                <a
                  href={profileUrlParam}
                  className="rs-btn rs-btn--ghost"
                >
                  Ouvrir mon profil privé
                </a>
              </div>
            ) : null}
            <div className="mt-2">
              <a
                href="/mon-espace"
                className="rs-btn rs-btn--ghost"
              >
                Aller à mon espace
              </a>
            </div>

            {shopifyCustomerId ? (
              <div className="mt-4 text-sm text-zinc-700">
                Shopify customer id:{" "}
                <span className="font-mono font-semibold">{shopifyCustomerId}</span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <label className="grid gap-1">
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
                onClick={() =>
                  setMode((m) => (m === "login" ? "signup" : "login"))
                }
                className="rs-btn rs-btn--ghost"
              >
                {mode === "login" ? "Passer en inscription" : "Passer en connexion"}
              </button>
            </div>

            <div className="mt-4">
              <button
                disabled={status === "sending"}
                onClick={() => void sendMagicLink()}
                className="rs-btn rs-btn--primary disabled:opacity-50"
              >
                {status === "sending" ? "Envoi..." : "Recevoir le lien de connexion"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                disabled={status === "authing"}
                onClick={() => void authWithEmailPassword()}
                className="rs-btn rs-btn--primary disabled:opacity-50"
              >
                {status === "authing"
                  ? "Connexion..."
                  : mode === "login"
                    ? "Connexion email/mot de passe"
                    : "Créer mon compte"}
              </button>
              <button
                disabled={status === "oauth"}
                onClick={() => void authWithGoogle()}
                className="rs-btn rs-btn--ghost disabled:opacity-50"
              >
                {status === "oauth" ? "Redirection..." : "Continuer avec Google"}
              </button>
            </div>
            {linkToken ? (
              <p className="mt-3 text-xs text-zinc-700">
                Après connexion, ton profil sera automatiquement rattaché via token.
              </p>
            ) : null}
          </>
        )}

        {message ? (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-700" : "text-zinc-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <div className="rs-panel rounded-lg p-6">
            <h1 className="text-xl font-black tracking-tight">Connexion</h1>
            <p className="mt-2 text-sm text-zinc-700">Chargement…</p>
          </div>
        </div>
      }
    >
      <ConnexionPageInner />
    </Suspense>
  );
}

