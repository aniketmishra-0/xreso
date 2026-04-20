"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, House, Play, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./FloatingQuickNav.module.css";

type FloatingQuickNavProps = {
  hidden?: boolean;
};

const isRouteActive = (pathname: string, href: string) => {
  if (href === "/") return pathname === "/";
  if (href === "/tracks") return pathname === "/tracks" || pathname.startsWith("/tracks/");
  if (href === "/videos") return pathname === "/videos" || pathname.startsWith("/videos/");
  return pathname === href;
};

export default function FloatingQuickNav({ hidden = false }: FloatingQuickNavProps) {
  const pathname = usePathname();
  const [tracksMenuOpen, setTracksMenuOpen] = useState(false);
  const tracksMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!tracksMenuRef.current) return;
      if (tracksMenuRef.current.contains(event.target as Node)) return;
      setTracksMenuOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  const isTracksOptionActive = pathname === "/tracks" || pathname.startsWith("/tracks/");

  return (
    <div
      className={`${styles.floatingToggleWrapper} ${hidden ? styles.floatingToggleWrapperHidden : ""}`}
      aria-hidden={hidden}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "opacity") return;
        if (hidden && tracksMenuOpen) {
          setTracksMenuOpen(false);
        }
      }}
    >
      <div className={styles.floatingToggle} role="navigation" aria-label="Quick navigation">
        <Link
          href="/"
          className={`${styles.toggleBtn} ${isRouteActive(pathname, "/") ? styles.toggleBtnActive : ""}`}
          aria-current={isRouteActive(pathname, "/") ? "page" : undefined}
          onClick={() => setTracksMenuOpen(false)}
        >
          <House size={14} />
          Home
        </Link>

        <div className={styles.trackMenu} ref={tracksMenuRef}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${styles.trackMenuTrigger} ${isTracksOptionActive || tracksMenuOpen ? styles.toggleBtnActive : ""}`}
            onClick={() => setTracksMenuOpen((open) => !open)}
            aria-expanded={tracksMenuOpen}
            aria-haspopup="menu"
          >
            <Zap size={14} />
            Tracks
            <ChevronDown size={14} className={`${styles.trackChevron} ${tracksMenuOpen ? styles.trackChevronOpen : ""}`} />
          </button>

          {tracksMenuOpen ? (
            <div className={styles.trackMenuPopover} role="menu" aria-label="Tracks options">
              <Link
                href="/core-code"
                className={`${styles.trackMenuItem} ${isRouteActive(pathname, "/core-code") ? styles.trackMenuItemActive : ""}`}
                role="menuitem"
                onClick={() => setTracksMenuOpen(false)}
              >
                Core Code
              </Link>
              <Link
                href="/tracks"
                className={`${styles.trackMenuItem} ${isRouteActive(pathname, "/tracks") ? styles.trackMenuItemActive : ""}`}
                role="menuitem"
                onClick={() => setTracksMenuOpen(false)}
              >
                Deep Tech
              </Link>
            </div>
          ) : null}
        </div>

        <Link
          href="/videos"
          className={`${styles.toggleBtn} ${isRouteActive(pathname, "/videos") ? styles.toggleBtnActive : ""}`}
          aria-current={isRouteActive(pathname, "/videos") ? "page" : undefined}
          onClick={() => setTracksMenuOpen(false)}
        >
          <Play size={14} />
          Videos
        </Link>
      </div>
    </div>
  );
}
