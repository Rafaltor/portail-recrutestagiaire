"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function HeaderAccountLink() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let alive = true;
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setConnected(!!data.session?.access_token);
    }
    void boot();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setConnected(!!session?.access_token);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const href = connected ? "/mon-espace" : "/connexion";
  return (
    <Link
      href={href}
      rel="noopener noreferrer"
      className="abt-btn rs-caf-btn-dossier rs-banner-top__account d-inline-flex align-items-center gap-2 text-nowrap text-decoration-none"
      aria-label="Mon espace"
    >
      <svg
        className="rs-icon-account"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21a8 8 0 0 0-16 0" />
        <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      </svg>
      <span className="rs-caf-btn-dossier__label">
        <span className="rs-caf-btn-dossier__text rs-caf-btn-dossier__text--full">
          Mon espace
        </span>
        <span
          className="rs-caf-btn-dossier__text rs-caf-btn-dossier__text--short"
          aria-hidden="true"
        >
          Espace
        </span>
      </span>
    </Link>
  );
}
