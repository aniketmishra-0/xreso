"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./Navbar.module.css";

type BrowseMode = "programming" | "advanced";

export default function Navbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Use initialState function to avoid hydration mismatch
  const [mounted, setMounted] = useState(() => typeof window !== "undefined");
  const [scrolled, setScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 14);

      if (mobileMenuOpen) {
        setHeaderHidden(false);
        lastScrollY = currentY;
        return;
      }

      if (currentY <= 16) {
        setHeaderHidden(false);
      } else if (currentY > lastScrollY + 8) {
        setHeaderHidden(true);
      } else if (currentY < lastScrollY - 8) {
        setHeaderHidden(false);
      }

      lastScrollY = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeUserMenu = () => setUserMenuOpen(false);

    if (!userMenuOpen) return;

    document.addEventListener("click", closeUserMenu);
    return () => document.removeEventListener("click", closeUserMenu);
  }, [userMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 860) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let active = true;

    async function loadProfileAvatar() {
      if (!session?.user?.id) {
        if (active) setProfileAvatar(null);
        return;
      }

      const sessionImage =
        typeof session.user.image === "string" && session.user.image.trim().length > 0
          ? session.user.image
          : null;

      if (sessionImage) {
        if (active) setProfileAvatar(sessionImage);
        return;
      }

      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;

        const payload = await response.json();
        const avatar =
          typeof payload?.user?.avatar === "string" && payload.user.avatar.trim().length > 0
            ? payload.user.avatar
            : null;

        if (active) setProfileAvatar(avatar);
      } catch {
        // Keep initials fallback when profile fetch fails.
      }
    }

    loadProfileAvatar();

    return () => {
      active = false;
    };
  }, [session?.user?.id, session?.user?.image]);

  const browseModeFromQuery: BrowseMode | null =
    searchParams.get("mode") === "advanced"
      ? "advanced"
      : searchParams.get("mode") === "programming"
        ? "programming"
        : null;

  const browseMode: BrowseMode = pathname.startsWith("/tracks")
    ? "advanced"
    : browseModeFromQuery || "programming";

  const isDark = theme === "dark";
  const themeLabel = mounted ? (isDark ? "Light" : "Dark") : "Theme";
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const resolvedAvatar = profileAvatar || session?.user?.image || null;

  const modeAwareSecondary =
    browseMode === "advanced"
      ? { href: "/tracks/categories", label: "Categories" }
      : { href: "/categories", label: "Categories" };

  const modeAwareBrowse =
    browseMode === "advanced"
      ? { href: "/tracks/library", label: "Browse" }
      : { href: "/browse", label: "Browse" };

  const uploadHref =
    browseMode === "advanced" ? "/upload?mode=advanced" : "/upload?mode=programming";

  const navItems = useMemo(
    () => [
      { id: "browse", href: modeAwareBrowse.href, label: "Browse" },
      { id: "secondary", href: modeAwareSecondary.href, label: modeAwareSecondary.label },
      { id: "about", href: "/about", label: "About" },
    ],
    [modeAwareBrowse.href, modeAwareSecondary.href, modeAwareSecondary.label],
  );

  const handleHomeLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);

    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (event.defaultPrevented || isModifiedClick) return;

    if (pathname === "/") {
      event.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      id="main-navbar"
      className={`${styles.header} ${scrolled ? styles.scrolled : ""} ${headerHidden ? styles.headerHidden : ""}`}
    >
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} id="nav-logo" onClick={handleHomeLogoClick}>
          <span className={styles.logoText}>xreso</span>
        </Link>

        <div className={styles.navLinks}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              id={`nav-${item.id}`}
              className={`${styles.navLink} ${pathname.startsWith(item.href) ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}

          <div className={styles.modeToggle} role="group" aria-label="Browse mode toggle">
            <Link
              href="/"
              className={`${styles.modeToggleBtn} ${browseMode === "programming" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
              aria-current={browseMode === "programming" ? "page" : undefined}
            >
              Programming
            </Link>
            <Link
              href="/tracks"
              className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
              aria-current={browseMode === "advanced" ? "page" : undefined}
            >
              Advanced
            </Link>
          </div>


        </div>

        <div className={styles.navActions}>
          <Link href={uploadHref} className={`btn btn-primary btn-sm ${styles.uploadBtn}`} id="nav-upload">
            Upload
          </Link>

          {session?.user ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userAvatar}
                id="nav-user-menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setUserMenuOpen((open) => !open);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {resolvedAvatar ? (
                  <Image
                    src={resolvedAvatar}
                    alt={session.user.name || "User"}
                    className={styles.userAvatarImage}
                    width={36}
                    height={36}
                    unoptimized
                  />
                ) : (
                  session.user.name?.charAt(0).toUpperCase() || "U"
                )}
              </button>

              {userMenuOpen ? (
                <div className={styles.dropdown} role="menu">
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownName}>{session.user.name}</span>
                    <span className={styles.dropdownEmail}>{session.user.email}</span>
                  </div>

                  <div className={styles.dropdownDivider} />
                  <Link href="/profile" className={styles.dropdownItem}>
                    My Profile
                  </Link>
                  <Link href="/profile?tab=bookmarks" className={styles.dropdownItem}>
                    Bookmarks
                  </Link>
                  {userRole === "admin" ? (
                    <Link href="/admin" className={styles.dropdownItem}>
                      Admin Dashboard
                    </Link>
                  ) : null}

                  <div className={styles.dropdownDivider} />
                  <button
                    className={styles.dropdownItem}
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                  >
                    Toggle Theme
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/login" className={`btn btn-ghost btn-sm ${styles.loginBtn}`} id="nav-login">
              Sign In
            </Link>
          )}
        </div>

        <button
          className={styles.mobileToggle}
          id="nav-mobile-toggle"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
          aria-expanded={mobileMenuOpen}
        >
          <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.open : ""}`} />
        </button>
      </nav>

      <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ""}`}>
        <div className={styles.mobileBody}>
          <div className={styles.modeToggle} role="group" aria-label="Browse mode toggle">
            <Link
              href="/"
              className={`${styles.modeToggleBtn} ${browseMode === "programming" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
            >
              Programming
            </Link>
            <Link
              href="/tracks"
              className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
            >
              Advanced
            </Link>
          </div>

          {navItems.map((item) => (
            <Link
              key={`mobile-${item.id}`}
              href={item.href}
              className={styles.mobileLink}
              onClick={closeMobileMenu}
            >
              {item.label}
            </Link>
          ))}

          <button
            className={styles.mobileLink}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {themeLabel}
          </button>

          <Link
            href={uploadHref}
            className={`btn btn-primary ${styles.mobileUpload}`}
            onClick={closeMobileMenu}
          >
            Upload Notes
          </Link>

          {session?.user ? (
            <>
              <Link
                href="/profile"
                className={`btn btn-secondary ${styles.mobileAuthBtn}`}
                onClick={closeMobileMenu}
              >
                My Profile
              </Link>
              <button
                className={`btn btn-ghost ${styles.mobileAuthBtn}`}
                onClick={() => {
                  closeMobileMenu();
                  signOut({ callbackUrl: "/" });
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={`btn btn-secondary ${styles.mobileAuthBtn}`}
              onClick={closeMobileMenu}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
