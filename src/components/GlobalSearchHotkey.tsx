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
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;

      const activeElement = document.activeElement;
      const globalSearchInput = document.querySelector<HTMLInputElement>(
        'input[data-global-search-input="true"]'
      );

      if (globalSearchInput) {
        event.preventDefault();
        globalSearchInput.focus({ preventScroll: false });
        globalSearchInput.select();
        return;
      }

      if (isTextInputElement(activeElement)) {
        return;
      }

      event.preventDefault();
      router.push("/search");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
