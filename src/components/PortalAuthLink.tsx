"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildConnexionHref, type ConnexionMode } from "@/lib/connexion-url";

type PortalAuthLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  mode?: ConnexionMode;
  onClick?: () => void;
};

export function PortalAuthLink({
  href,
  className,
  children,
  mode = "login",
  onClick,
}: PortalAuthLinkProps) {
  const [connected, setConnected] = useState<boolean | null>(null);

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

  const targetHref =
    connected === true ? href : buildConnexionHref(href, mode);

  return (
    <Link href={targetHref} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
