"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function prefersTapForSubnav(): boolean {
  try {
    if (window.matchMedia("(hover: none)").matches) return true;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  return w > 0 && w <= 991.98;
}

function useTapSubnavForRoute(pathname: string | null): boolean {
  if (pathname === "/swipe") return true;
  return prefersTapForSubnav();
}

function shouldLockBodyForOpenMenu(pathname: string | null): boolean {
  if (pathname === "/swipe" && typeof window !== "undefined") {
    try {
      if (window.matchMedia("(min-width: 768px)").matches) return false;
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function HeaderMobileNav() {
  const pathname = usePathname();

  useEffect(() => {
    const header = document.querySelector(".header-wrap");
    if (!header) return;

    const list = header.querySelector(".rs-subnav.rs-subnav--buttons");
    if (!list) return;
    const listEl = list;

    const tapSubnav = useTapSubnavForRoute(pathname);

    let lockedY = 0;

    function lockScroll() {
      if (!shouldLockBodyForOpenMenu(pathname)) return;
      if (document.documentElement.getAttribute("data-rs-nav-scroll-lock") === "1") return;
      document.documentElement.setAttribute("data-rs-nav-scroll-lock", "1");
      lockedY = window.scrollY || document.documentElement.scrollTop || 0;
      document.documentElement.classList.add("rs-nav-open");
      document.body.classList.add("rs-nav-open");
      document.body.style.position = "fixed";
      document.body.style.top = `${-lockedY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    function unlockScroll() {
      if (document.documentElement.getAttribute("data-rs-nav-scroll-lock") !== "1") return;
      document.documentElement.removeAttribute("data-rs-nav-scroll-lock");
      document.documentElement.classList.remove("rs-nav-open");
      document.body.classList.remove("rs-nav-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, lockedY);
    }

    const onDocClick = (e: MouseEvent) => {
      if (!tapSubnav) return;
      if (!header.contains(e.target as Node)) closeAll();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!tapSubnav) return;
      if (e.key === "Escape") closeAll();
    };

    function resetDropdownLayout(dropdown: HTMLElement | null) {
      if (!dropdown) return;
      dropdown.style.position = "";
      dropdown.style.left = "";
      dropdown.style.top = "";
      dropdown.style.right = "";
      dropdown.style.width = "";
      dropdown.style.zIndex = "";
      dropdown.style.maxHeight = "";
      dropdown.style.overflowY = "";
      dropdown.style.opacity = "";
      dropdown.style.visibility = "";
      dropdown.style.transform = "";
      dropdown.style.transition = "";
      dropdown.style.display = "";
    }

    function positionDropdown(li: Element) {
      const item = li as HTMLElement;
      const btn = item.querySelector<HTMLButtonElement>(".rs-subnav__trigger");
      const dropdown = item.querySelector<HTMLElement>(".rs-subnav__dropdown");
      if (!btn || !dropdown) return;

      const br = btn.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const pad = 10;
      const minW = 220;
      const maxW = Math.max(0, vw - pad * 2);
      const width = Math.min(Math.max(br.width, minW), maxW);
      /* Centrer sous le bouton, puis garder le panneau dans le viewport */
      let left = br.left + (br.width - width) / 2;
      left = Math.max(pad, Math.min(left, vw - pad - width));

      dropdown.style.position = "fixed";
      dropdown.style.left = `${Math.round(left)}px`;
      dropdown.style.top = `${Math.round(br.bottom)}px`;
      dropdown.style.right = "auto";
      dropdown.style.width = `${Math.round(width)}px`;
      dropdown.style.zIndex = "20000";
      dropdown.style.maxHeight = `calc(100vh - ${Math.round(br.bottom + 8)}px)`;
      dropdown.style.overflowY = "auto";
      dropdown.style.display = "block";

      dropdown.style.transition = "opacity 160ms ease, transform 160ms ease";
      dropdown.style.opacity = "0";
      dropdown.style.visibility = "visible";
      dropdown.style.transform = "translateY(-6px)";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dropdown.style.opacity = "1";
          dropdown.style.transform = "translateY(0)";
        });
      });
    }

    function closeAll() {
      listEl.querySelectorAll(".rs-subnav__item.is-open").forEach((li) => {
        li.classList.remove("is-open");
        const btn = li.querySelector<HTMLButtonElement>(".rs-subnav__trigger");
        if (btn) btn.setAttribute("aria-expanded", "false");
        resetDropdownLayout(li.querySelector<HTMLElement>(".rs-subnav__dropdown"));
      });
      unlockScroll();
    }

    const onViewportChange = () => {
      if (!tapSubnav) return;
      const open = listEl.querySelector(".rs-subnav__item.is-open");
      if (open) positionDropdown(open);
    };

    const triggers: Array<{ btn: HTMLButtonElement; onClick: (e: Event) => void }> = [];

    listEl.querySelectorAll(".rs-subnav__item").forEach((li) => {
      const btn = li.querySelector<HTMLButtonElement>(".rs-subnav__trigger");
      if (!btn) return;

      btn.setAttribute("aria-expanded", "false");

      const onClick = (e: Event) => {
        if (!tapSubnav) return;
        e.preventDefault();
        e.stopPropagation();
        const isOpen = li.classList.contains("is-open");
        closeAll();
        if (!isOpen) {
          li.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          lockScroll();
          positionDropdown(li);
        }
      };

      btn.addEventListener("click", onClick);
      triggers.push({ btn, onClick });
    });

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    const onResize = () => {
      if (!tapSubnav) closeAll();
      else onViewportChange();
    };

    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      triggers.forEach(({ btn, onClick }) => btn.removeEventListener("click", onClick));
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onResize);
      closeAll();
    };
  }, [pathname]);

  return null;
}
