"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LinkRes = { ok: true; shopifyCustomerId: string };

export default function ConnexionPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "linking" | "error" | "linked"
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

  useEffect(() => {
    let alive = true;
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) return;
      setUserEmail(data.user?.email ?? "");
    }
    void loadUser();
    return () => {
      alive = false;
    };
  }, []);

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
        emailRedirectTo: redirectTo || `${window.location.origin}/connexion`,
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
      setMessage(j?.error || "Impossible de lier le compte Shopify.");
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
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-black tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Connexion rapide (email) pour lier ton compte au portail.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        {userEmail ? (
          <>
            <div className="text-sm text-zinc-700">
              Connecté en tant que <span className="font-semibold">{userEmail}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                disabled={status === "linking"}
                onClick={() => void linkShopify()}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {status === "linking" ? "Liaison..." : "Lier Shopify"}
              </button>

              <button
                onClick={() => void signOut()}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Déconnexion
              </button>
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

            <div className="mt-4">
              <button
                disabled={status === "sending"}
                onClick={() => void sendMagicLink()}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {status === "sending" ? "Envoi..." : "Recevoir le lien de connexion"}
              </button>
            </div>
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

