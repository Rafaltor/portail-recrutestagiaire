"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LinkRes = { ok: true; shopifyCustomerId: string };

const connexionInputClass =
  "w-full rounded-[12px] border-[1.5px] border-[#e8e8e4] bg-white px-4 py-3 font-[family-name:var(--font-dm)] text-[14px] font-normal text-[#0a0a0a] outline-none transition-[border-color] focus:border-[#f472b6]";

const connexionPrimaryBtn =
  "w-full rounded-full border-0 bg-[#0a0a0a] py-[14px] text-center font-[family-name:var(--font-dm)] text-[14px] font-medium text-white transition-colors hover:bg-[#f472b6] disabled:cursor-not-allowed disabled:opacity-50";

const connexionOutlineBtn =
  "inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-[#e8e8e4] bg-white py-[14px] text-center font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a] transition-colors hover:border-[#0a0a0a]";

/** Bouton « Continuer avec Google » — charte portail. */
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
      className="flex w-full max-w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-[#e8e8e4] bg-white px-4 py-[14px] font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a] transition-colors hover:border-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-55"
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
    <div className="mx-auto grid w-full max-w-[var(--rs-content-max,1200px)] gap-8 pb-10">
      <div className="hidden lg:block">
        <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
          Compte
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-tight text-[#0a0a0a]">
          Connexion
        </h1>
      </div>

      <div className="lg:hidden">
        <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
          Compte
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-tight text-[#0a0a0a]">
          Connexion
        </h1>
      </div>

      {userEmail ? (
        <div className="mx-auto w-full max-w-[480px] rounded-[20px] border border-[#e8e8e4] bg-white p-8 shadow-none sm:p-10">
          <div className="font-[family-name:var(--font-dm)] text-sm text-[#0a0a0a]/90">
            Connecté en tant que <span className="font-semibold">{userEmail}</span>
          </div>
          {linkToken ? (
            <div className="mt-2 font-mono text-xs text-[#0a0a0a]/80">
              Token détecté: {linkToken}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={status === "linking"}
              onClick={() => void linkShopify()}
              className={connexionPrimaryBtn}
            >
              {status === "linking" ? "Liaison…" : "Lier Shopify"}
            </button>

            <button type="button" onClick={() => void signOut()} className={connexionOutlineBtn}>
              Déconnexion
            </button>
          </div>
          {profileUrlParam ? (
            <div className="mt-3">
              <a href={profileUrlParam} className={`${connexionOutlineBtn} no-underline`}>
                Ouvrir mon profil privé
              </a>
            </div>
          ) : null}
          <div className="mt-3">
            <a href="/mon-espace" className={`${connexionOutlineBtn} no-underline`}>
              Aller à mon espace
            </a>
          </div>

          {shopifyCustomerId ? (
            <div className="mt-4 font-[family-name:var(--font-dm)] text-sm text-[#0a0a0a]/85">
              Shopify customer id:{" "}
              <span className="font-mono font-semibold">{shopifyCustomerId}</span>
            </div>
          ) : null}

          {message ? (
            <p
              className={`mt-4 font-[family-name:var(--font-dm)] text-sm ${
                status === "error" ? "text-red-700" : "text-[#0a0a0a]/85"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mx-auto grid w-full max-w-[960px] gap-8 lg:grid-cols-2 lg:gap-10">
            <section
              className="rounded-[20px] border border-[#e8e8e4] bg-white p-6 sm:p-8"
              aria-labelledby="connexion-col-title"
            >
              <h2
                id="connexion-col-title"
                className="font-[family-name:var(--font-syne)] text-[18px] font-extrabold tracking-tight text-[#0a0a0a]"
              >
                Connexion
              </h2>
              <p className="mt-2 font-[family-name:var(--font-dm)] text-[14px] font-normal text-[#555550]">
                Google ou email et mot de passe.
              </p>

              <div className="mt-6">
                <GoogleAuthButton
                  disabled={loginPwdBusy || signupPwdBusy}
                  loading={oauthBusy}
                  onClick={() => void authWithGoogle()}
                  label="Continuer avec Google"
                />
              </div>

              <div className="mt-8">
                <p className="font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a]">
                  Email et mot de passe
                </p>
                <label className="mt-3 grid gap-1.5">
                  <span className="font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a]">
                    Email
                  </span>
                  <input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={connexionInputClass}
                    placeholder="toi@exemple.com"
                    autoComplete="email"
                  />
                </label>
                <label className="mt-4 grid gap-1.5">
                  <span className="font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a]">
                    Mot de passe
                  </span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={connexionInputClass}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </label>
                <button
                  type="button"
                  disabled={loginPwdBusy || oauthBusy}
                  onClick={() => void signInWithEmailPassword()}
                  className={`${connexionPrimaryBtn} mt-5`}
                >
                  {loginPwdBusy ? "Connexion…" : "Se connecter"}
                </button>
              </div>
            </section>

            <section
              className="rounded-[20px] border border-[#e8e8e4] bg-white p-6 sm:p-8"
              aria-labelledby="connexion-inscription"
            >
              <h2
                id="connexion-inscription"
                className="font-[family-name:var(--font-syne)] text-[18px] font-extrabold tracking-tight text-[#0a0a0a]"
              >
                Inscription
              </h2>
              <p className="mt-2 font-[family-name:var(--font-dm)] text-[14px] font-normal text-[#555550]">
                Nouveau sur le portail ? Crée ton compte ci-dessous.
              </p>
              <label className="mt-6 grid gap-1.5">
                <span className="font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a]">
                  Email
                </span>
                <input
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={connexionInputClass}
                  placeholder="toi@exemple.com"
                  autoComplete="email"
                />
              </label>
              <label className="mt-4 grid gap-1.5">
                <span className="font-[family-name:var(--font-dm)] text-[14px] font-medium text-[#0a0a0a]">
                  Mot de passe
                </span>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className={connexionInputClass}
                  placeholder="Minimum 6 caractères"
                  autoComplete="new-password"
                />
              </label>
              <button
                type="button"
                disabled={signupPwdBusy || oauthBusy}
                onClick={() => void signUpWithEmailPassword()}
                className={`${connexionPrimaryBtn} mt-5`}
              >
                {signupPwdBusy ? "Création…" : "Créer mon compte"}
              </button>
            </section>
          </div>

          {linkToken ? (
            <p className="mx-auto mt-6 max-w-[960px] font-[family-name:var(--font-dm)] text-xs text-[#555550]">
              Après connexion, ton profil sera automatiquement rattaché via token.
            </p>
          ) : null}

          {message ? (
            <p
              className={`mx-auto mt-4 max-w-[960px] font-[family-name:var(--font-dm)] text-sm ${
                status === "error" ? "text-red-700" : "text-[#0a0a0a]/85"
              }`}
            >
              {message}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid w-full max-w-[var(--rs-content-max,1200px)] gap-6 pb-10">
          <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
            Compte
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold text-[#0a0a0a]">
            Connexion
          </h1>
          <p className="font-[family-name:var(--font-dm)] text-sm text-[#555550]">Chargement…</p>
        </div>
      }
    >
      <ConnexionPageInner />
    </Suspense>
  );
}
