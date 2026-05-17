"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PortalAuthLink } from "@/components/PortalAuthLink";

/**
 * Menu mobile : panneau pleine largeur depuis le haut (design system Paris).
 */
export function PortalHeaderDrawer() {
  useEffect(() => {
    const wrap = document.querySelector(".header-wrap");
    if (!wrap) return;
    const drawerEl = wrap.querySelector<HTMLElement>("[data-rs-header-drawer]");
    const openBtnEl = wrap.querySelector<HTMLElement>("[data-rs-header-drawer-open]");
    if (!drawerEl || !openBtnEl) return;

    const drawer = drawerEl;
    const openBtn = openBtnEl;

    const closes = drawer.querySelectorAll<HTMLElement>("[data-rs-header-drawer-close]");

    function isMobileDrawer() {
      try {
        return window.matchMedia("(max-width: 899.98px)").matches;
      } catch {
        return (window.innerWidth || 0) <= 899;
      }
    }

    let scrollY = 0;

    function lockScroll() {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.documentElement.classList.add("rs-header-drawer-open");
      document.body.style.position = "fixed";
      document.body.style.top = `${-scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    function unlockScroll() {
      document.documentElement.classList.remove("rs-header-drawer-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    }

    function openDrawer() {
      if (!isMobileDrawer()) return;
      drawer.removeAttribute("hidden");
      openBtn.setAttribute("aria-expanded", "true");
      lockScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drawer.classList.add("rs-header-drawer--open");
          const c = drawer.querySelector<HTMLElement>(".rs-header-drawer__close");
          c?.focus();
        });
      });
    }

    function closeDrawer() {
      drawer.classList.remove("rs-header-drawer--open");
      openBtn.setAttribute("aria-expanded", "false");
      unlockScroll();
      window.setTimeout(() => {
        if (!drawer.classList.contains("rs-header-drawer--open")) {
          drawer.setAttribute("hidden", "");
        }
      }, 280);
    }

    const onOpenClick = (e: Event) => {
      e.preventDefault();
      if (drawer.classList.contains("rs-header-drawer--open")) closeDrawer();
      else openDrawer();
    };

    const onCloseClick = (e: Event) => {
      e.preventDefault();
      closeDrawer();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawer.classList.contains("rs-header-drawer--open")) {
        closeDrawer();
        openBtn.focus();
      }
    };

    const onResize = () => {
      if (!isMobileDrawer() && drawer.classList.contains("rs-header-drawer--open")) {
        closeDrawer();
      }
    };

    openBtn.addEventListener("click", onOpenClick);
    closes.forEach((el) => el.addEventListener("click", onCloseClick));
    drawer.querySelectorAll(".rs-header-drawer__caf-btn").forEach((a) => {
      a.addEventListener("click", closeDrawer);
    });
    drawer.querySelectorAll(".rs-header-drawer__sublinks a").forEach((a) => {
      a.addEventListener("click", closeDrawer);
    });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      openBtn.removeEventListener("click", onOpenClick);
      closes.forEach((el) => el.removeEventListener("click", onCloseClick));
      drawer.querySelectorAll(".rs-header-drawer__caf-btn").forEach((a) => {
        a.removeEventListener("click", closeDrawer);
      });
      drawer.querySelectorAll(".rs-header-drawer__sublinks a").forEach((a) => {
        a.removeEventListener("click", closeDrawer);
      });
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      closeDrawer();
    };
  }, []);

  useEffect(() => {
    const wrapEl = document.querySelector<HTMLElement>(".header-wrap.rs-header");
    if (!wrapEl) return;
    const wrap = wrapEl;

    function isMobileHeader() {
      try {
        return window.matchMedia("(max-width: 899.98px)").matches;
      } catch {
        return (window.innerWidth || 0) <= 899;
      }
    }

    function updateMobileMainOffset() {
      if (!isMobileHeader()) {
        document.documentElement.style.removeProperty("--rs-mobile-header-offset");
        return;
      }
      const h = wrap.offsetHeight || 0;
      if (h > 0) {
        document.documentElement.style.setProperty("--rs-mobile-header-offset", `${h}px`);
      }
    }

    function onWindowScroll() {
      if (!isMobileHeader()) {
        wrap.classList.remove("rs-header-mobile-fixed--scrolled");
        return;
      }
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        0;
      wrap.classList.toggle("rs-header-mobile-fixed--scrolled", y > 2);
    }

    function sync() {
      updateMobileMainOffset();
      onWindowScroll();
    }

    sync();
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("scroll", onWindowScroll, { passive: true });

    const imgLoads: Array<{ el: HTMLImageElement; fn: () => void }> = [];
    wrap.querySelectorAll("img").forEach((img) => {
      const el = img as HTMLImageElement;
      if (!el.complete) {
        const fn = () => updateMobileMainOffset();
        el.addEventListener("load", fn, { passive: true });
        imgLoads.push({ el, fn });
      }
    });

    let fontsDone: Promise<void> | undefined;
    if (document.fonts?.ready) {
      fontsDone = document.fonts.ready.then(() => updateMobileMainOffset()).catch(() => {});
    }

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      try {
        ro = new ResizeObserver(updateMobileMainOffset);
        ro.observe(wrap);
      } catch {
        /* ignore */
      }
    }

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", onWindowScroll);
      imgLoads.forEach(({ el, fn }) => el.removeEventListener("load", fn));
      void fontsDone;
      ro?.disconnect();
      document.documentElement.style.removeProperty("--rs-mobile-header-offset");
      wrap.classList.remove("rs-header-mobile-fixed--scrolled");
    };
  }, []);

  return (
    <div
      className="rs-header-drawer"
      id="rs-header-drawer"
      data-rs-header-drawer
      hidden
    >
      <div
        className="rs-header-drawer__overlay"
        data-rs-header-drawer-close
        tabIndex={-1}
        aria-hidden="true"
      />
      <div
        className="rs-header-drawer__panel"
        id="rs-header-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-header-drawer-title"
      >
        <div className="rs-header-drawer__head">
          <span className="sr-only" id="rs-header-drawer-title">
            Menu
          </span>
          <button
            type="button"
            className="rs-header-drawer__close"
            data-rs-header-drawer-close
            aria-label="Fermer le menu"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav className="rs-header-drawer__nav" aria-label="Navigation principale">
          <div className="rs-header-drawer__section">
            <div className="rs-header-drawer__sublinks">
              <Link href="/profils">Profils candidats</Link>
              <PortalAuthLink href="/swipe">Voter</PortalAuthLink>
            </div>
          </div>
        </nav>
        <div className="rs-header-drawer__footer">
          <div className="rs-header-drawer__footer-actions flex w-full flex-col gap-2.5">
            <PortalAuthLink
              href="/depot"
              mode="signup"
              className="rs-ph-drawer-cta rs-btn rs-btn--primary rs-header-drawer__caf-btn w-full text-center text-decoration-none no-underline hover:no-underline"
            >
              Déposer mon CV
            </PortalAuthLink>
            <PortalAuthLink
              href="/mon-espace"
              className="rs-header-drawer__caf-btn rs-ph-drawer-cta--outline w-full text-center text-decoration-none no-underline hover:no-underline"
            >
              Mon espace
            </PortalAuthLink>
          </div>
        </div>
      </div>
    </div>
  );
}
