"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

type LinkRes = { ok: true; shopifyCustomerId: string };

/** Bouton « Continuer avec Google » — charte portail (bordure #F0F0F0, sans ombre). */
function GoogleAuthButton({
  disabled,
  loading,
  onClick,
  label,
}: {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="flex h-11 w-full max-w-full items-center justify-center gap-3 rounded-[6px] border border-[#F0F0F0] bg-white px-3 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-55"
    >
      {loading ? (
        <span className="text-[13px]">Redirection…</span>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.69 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C43.86 35.61 46.98 30.54 46.98 24.55z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          <span className="truncate">{label}</span>
        </>
      )}
    </button>
  );
}

function ConnexionPageInner() {
  const searchParams = useSearchParams();
  const linkToken = String(searchParams.get("token") || "").trim();
  const profileUrlParam = String(searchParams.get("profileUrl") || "").trim();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [status, setStatus] = useState<
    | "idle"
    | "sent"
    | "linking"
    | "error"
    | "linked"
    | "authing-login"
    | "authing-signup"
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

  async function signInWithEmailPassword() {
    setStatus("authing-login");
    setMessage("");
    const clean = loginEmail.trim();
    if (!clean || !clean.includes("@")) {
      setStatus("error");
      setMessage("Email invalide.");
      return;
    }
    if (loginPassword.length < 6) {
      setStatus("error");
      setMessage("Mot de passe trop court (min 6).");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: clean,
      password: loginPassword,
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

  async function signUpWithEmailPassword() {
    setStatus("authing-signup");
    setMessage("");
    const clean = signupEmail.trim();
    if (!clean || !clean.includes("@")) {
      setStatus("error");
      setMessage("Email invalide.");
      return;
    }
    if (signupPassword.length < 6) {
      setStatus("error");
      setMessage("Mot de passe trop court (min 6).");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: clean,
      password: signupPassword,
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

  const oauthBusy = status === "oauth";
  const loginPwdBusy = status === "authing-login";
  const signupPwdBusy = status === "authing-signup";

  return (
    <div className="grid gap-6">
      <PortalDesktopPageHeader
        eyebrow="Compte"
        title="Connexion"
        description="Connecte-toi ou crée un compte : Google ou email et mot de passe."
      />

      <div className="rs-panel rounded-[8px] p-6 lg:hidden">
        <h1 className="text-xl font-bold tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm font-normal text-[#6B6B6B]">
          Google ou email — inscription sur la même page.
        </p>
      </div>

      <div
        className={`mx-auto w-full rounded-[8px] border border-[#F0F0F0] bg-white p-8 shadow-none ${
          userEmail ? "max-w-xl" : "max-w-[400px]"
        }`}
      >
        {userEmail ? (
          <>
            <div className="text-sm text-[#0A0A0A]/85">
              Connecté en tant que <span className="font-semibold">{userEmail}</span>
            </div>
            {linkToken ? (
              <div className="mt-2 text-xs text-[#0A0A0A]/85">
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
                <a href={profileUrlParam} className="rs-btn rs-btn--ghost">
                  Ouvrir mon profil privé
                </a>
              </div>
            ) : null}
            <div className="mt-2">
              <a href="/mon-espace" className="rs-btn rs-btn--ghost">
                Aller à mon espace
              </a>
            </div>

            {shopifyCustomerId ? (
              <div className="mt-4 text-sm text-[#0A0A0A]/85">
                Shopify customer id:{" "}
                <span className="font-mono font-semibold">{shopifyCustomerId}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-0">
            <h2 className="text-xl font-bold tracking-tight text-[#0A0A0A]">
              Connexion
            </h2>
            <p className="mt-1 text-sm font-normal text-[#6B6B6B]">
              Déjà un compte ou nouveau — même bouton Google.
            </p>

            <div className="mt-6">
              <GoogleAuthButton
                disabled={loginPwdBusy || signupPwdBusy}
                loading={oauthBusy}
                onClick={() => void authWithGoogle()}
                label="Continuer avec Google"
              />
            </div>

            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[#F0F0F0]" />
              <span className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                ou
              </span>
              <span className="h-px flex-1 bg-[#F0F0F0]" />
            </div>

            <div>
              <p className="text-sm font-medium text-[#0A0A0A]">Connexion email</p>
              <label className="mt-3 grid gap-1">
                <span className="text-sm font-medium text-[#0A0A0A]">Email</span>
                <input
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                  placeholder="toi@exemple.com"
                  autoComplete="email"
                />
              </label>
              <label className="mt-3 grid gap-1">
                <span className="text-sm font-medium text-[#0A0A0A]">Mot de passe</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>
              <button
                disabled={loginPwdBusy || oauthBusy}
                onClick={() => void signInWithEmailPassword()}
                className="rs-btn rs-btn--primary mt-4 w-full disabled:opacity-50"
              >
                {loginPwdBusy ? "Connexion…" : "Se connecter"}
              </button>
            </div>

            <div className="mt-10 border-t border-[#F0F0F0] pt-8">
              <h3 className="text-lg font-bold tracking-tight text-[#0A0A0A]">
                Inscription
              </h3>
              <p className="mt-1 text-sm font-normal text-[#6B6B6B]">
                Nouveau sur le portail ? Crée ton compte ci-dessous.
              </p>
              <label className="mt-4 grid gap-1">
                <span className="text-sm font-medium text-[#0A0A0A]">Email</span>
                <input
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                  placeholder="toi@exemple.com"
                  autoComplete="email"
                />
              </label>
              <label className="mt-3 grid gap-1">
                <span className="text-sm font-medium text-[#0A0A0A]">Mot de passe</span>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                  placeholder="Minimum 6 caractères"
                  autoComplete="new-password"
                />
              </label>
              <button
                disabled={signupPwdBusy || oauthBusy}
                onClick={() => void signUpWithEmailPassword()}
                className="rs-btn rs-btn--primary mt-4 w-full disabled:opacity-50"
              >
                {signupPwdBusy ? "Création…" : "Créer mon compte"}
              </button>
            </div>
          </div>
        )}

        {linkToken && !userEmail ? (
          <p className="mt-4 text-xs text-[#0A0A0A]/75">
            Après connexion, ton profil sera automatiquement rattaché via token.
          </p>
        ) : null}

        {message ? (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-700" : "text-[#0A0A0A]/85"
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
          <PortalDesktopPageHeader
            eyebrow="Compte"
            title="Connexion"
            description="Chargement de la page…"
          />
          <div className="rs-panel rounded-lg p-6 lg:hidden">
            <h1 className="text-xl font-black tracking-tight">Connexion</h1>
            <p className="mt-2 text-sm text-[#0A0A0A]/85">Chargement…</p>
          </div>
        </div>
      }
    >
      <ConnexionPageInner />
    </Suspense>
  );
}
