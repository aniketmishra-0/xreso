"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isTextInputElement(element: EventTarget | null) {
  if (!(element instanceof HTMLElement)) return false;

  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return element.isContentEditable;
}

export default function GlobalSearchHotkey() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isCmdOrCtrlK = (event.metaKey || event.ctrlKey) && key === "k";
      const isSlashShortcut =
        key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey;
      if (!isCmdOrCtrlK && !isSlashShortcut) return;

      const activeElement = document.activeElement;
      if (isTextInputElement(activeElement)) return;

      const globalSearchInput = document.querySelector<HTMLInputElement>(
        'input[data-global-search-input="true"]'
      );

      event.preventDefault();

      if (globalSearchInput) {
        globalSearchInput.focus({ preventScroll: false });
        globalSearchInput.select();
        return;
      }

      router.push("/search");
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [router]);

  return null;
}
