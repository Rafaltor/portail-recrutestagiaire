"use client";

import { useEffect, useState } from "react";

export function StatsBar() {
  const [cvCount, setCvCount] = useState<number | null>(null);
  const [voteCount, setVoteCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/profils/top")
      .then((r) => r.json())
      .then((d) => {
        setCvCount(d?.total ?? d?.profiles?.length ?? null);
      })
      .catch(() => {});
  }, []);

  const nextRecruitDate = new Date("2026-06-01");
  const daysLeft = Math.max(
    0,
    Math.ceil((nextRecruitDate.getTime() - Date.now()) / 86400000),
  );

  return (
    <div className="mx-auto my-8 grid max-w-3xl grid-cols-3 gap-4 rounded-xl bg-[#F5F5F5] p-6">
      {[
        { value: cvCount, label: "CVs dans la base" },
        { value: daysLeft, label: "Jours avant le prochain recrutement" },
        { value: "✦", label: "Candidatures ouvertes" },
      ].map(({ value, label }) => (
        <div key={label} className="flex flex-col items-center gap-1 text-center">
          <span className="text-3xl font-black text-[#E11D48]">
            {value ?? "—"}
          </span>
          <span className="text-xs text-[#6B6B6B]">{label}</span>
        </div>
      ))}
    </div>
  );
}
