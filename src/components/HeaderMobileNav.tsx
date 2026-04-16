"use client";

import { useEffect } from "react";

export function HeaderMobileNav() {
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 575.98px)");
    const header = document.querySelector(".header-wrap");
    if (!header) return;

    const list = header.querySelector(".rs-subnav.rs-subnav--buttons");
    if (!list) return;
    const listEl = list;

    const onDocClick = (e: MouseEvent) => {
      if (!mq.matches) return;
      if (!header.contains(e.target as Node)) closeAll();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!mq.matches) return;
      if (e.key === "Escape") closeAll();
    };

    function resetDropdownLayout(dropdown: HTMLElement | null) {
      if (!dropdown) return;
      dropdown.style.position = "";
      dropdown.style.left = "";
      dropdown.style.top = "";
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
      const left = Math.max(pad, Math.min(br.left, vw - pad));
      const width = Math.min(Math.max(br.width, 220), vw - pad * 2);

      dropdown.style.position = "fixed";
      dropdown.style.left = `${left}px`;
      dropdown.style.top = `${Math.round(br.bottom)}px`;
      dropdown.style.width = `${width}px`;
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
    }

    const onViewportChange = () => {
      if (!mq.matches) return;
      const open = listEl.querySelector(".rs-subnav__item.is-open");
      if (!open) return;
      positionDropdown(open);
    };

    const triggers: Array<{ li: Element; btn: HTMLButtonElement; onClick: (e: Event) => void }> =
      [];

    listEl.querySelectorAll(".rs-subnav__item").forEach((li) => {
      const btn = li.querySelector<HTMLButtonElement>(".rs-subnav__trigger");
      if (!btn) return;

      btn.setAttribute("aria-expanded", "false");

      const onClick = (e: Event) => {
        if (!mq.matches) return;
        e.preventDefault();
        e.stopPropagation();
        const isOpen = li.classList.contains("is-open");
        closeAll();
        if (!isOpen) {
          li.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          positionDropdown(li);
        }
      };

      btn.addEventListener("click", onClick);
      triggers.push({ li, btn, onClick });
    });

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    const onMqChange = () => {
      if (!mq.matches) closeAll();
      else onViewportChange();
    };

    if (mq.addEventListener) {
      mq.addEventListener("change", onMqChange);
    } else {
      // Safari legacy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mq as any).addListener?.(onMqChange);
    }

    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      if (mq.removeEventListener) {
        mq.removeEventListener("change", onMqChange);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mq as any).removeListener?.(onMqChange);
      }
      triggers.forEach(({ btn, onClick }) => btn.removeEventListener("click", onClick));
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      closeAll();
    };
  }, []);

  return null;
}
