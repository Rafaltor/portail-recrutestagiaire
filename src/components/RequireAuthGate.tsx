"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ConnexionOverlay } from "@/components/ConnexionOverlay";
import type { ConnexionMode } from "@/lib/connexion-url";

type RequireAuthGateProps = {
  children: React.ReactNode;
  nextPath: string;
  initialMode?: ConnexionMode;
};

export function RequireAuthGate({
  children,
  nextPath,
  initialMode = "login",
}: RequireAuthGateProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    }
    void boot();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="font-[family-name:var(--font-dm)] text-sm text-[#555550]">
          Vérification de la session…
        </p>
      </div>
    );
  }

  if (!session?.access_token) {
    return (
      <ConnexionOverlay
        initialMode={initialMode}
        onClose={() => router.push("/")}
      />
    );
  }

  return <>{children}</>;
}
