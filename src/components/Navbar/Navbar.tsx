"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import FloatingQuickNav from "@/components/FloatingQuickNav/FloatingQuickNav";
import styles from "./Navbar.module.css";

type BrowseMode = "programming" | "advanced";

export default function Navbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [scrolled, setScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [loginPromptContext, setLoginPromptContext] = useState<"upload" | "contribute">("upload");

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
    if (!loginPromptOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLoginPromptOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [loginPromptOpen]);

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
  const isHomeHubRoute = pathname === "/home";
  const isNoteDetailRoute = pathname.startsWith("/note/");
  const isTrackNotesRoute = pathname.startsWith("/tracks/notes");
  const isVideoDetailRoute = pathname.startsWith("/videos/") && pathname !== "/videos";
  const isVideoModalOpen = pathname === "/videos" && !!searchParams.get("video");
  const isLoginRoute = pathname === "/login";
  const isForgotPasswordRoute = pathname === "/forgot-password";
  const isResetPasswordRoute = pathname.startsWith("/reset-password");
  const isProfileRoute = pathname.startsWith("/profile");
  const isAdminRoute = pathname.startsWith("/admin");
  const shouldHideFloatingQuickNav =
    headerHidden ||
    mobileMenuOpen ||
    isNoteDetailRoute ||
    isTrackNotesRoute ||
    isVideoDetailRoute ||
    isVideoModalOpen ||
    isLoginRoute ||
    isForgotPasswordRoute ||
    isResetPasswordRoute ||
    isProfileRoute ||
    isAdminRoute;

  const isDark = theme === "dark";
  const themeLabel = isDark ? "Light" : theme === "light" ? "Dark" : "Theme";
  const isAuthenticated = Boolean(session?.user);
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const resolvedAvatar = profileAvatar || session?.user?.image || null;

  const modeAwareSecondary =
    browseMode === "advanced"
      ? { href: "/tracks/categories", label: "Category" }
      : { href: "/categories", label: "Category" };

  const modeAwareBrowse =
    browseMode === "advanced"
      ? { href: "/tracks/library", label: "Browse" }
      : { href: "/browse", label: "Browse" };

  const modeAwareHome = browseMode === "advanced" ? "/home?mode=advanced" : "/home";

  const uploadHref = browseMode === "advanced" ? "/upload?mode=advanced" : "/upload?mode=programming";
  const mobileQuickUploadHref =
    browseMode === "advanced"
      ? "/upload?mode=advanced#resource-section"
      : "/upload?mode=programming#upload-drop-zone";
  const navUploadHref = uploadHref;
  const navMobileQuickUploadHref = mobileQuickUploadHref;
  const loginPromptCallbackPath =
    loginPromptContext === "contribute" ? mobileQuickUploadHref : uploadHref;
  const loginPromptHref =
    `/login?callbackUrl=${encodeURIComponent(loginPromptCallbackPath)}&reason=upload_login_required`;
  const loginPromptMessage =
    loginPromptContext === "contribute"
      ? "Please login first, then contribute your resource."
      : "Please login first, then upload your notes.";
  const mobileQuickUploadLabel = browseMode === "advanced" ? "Contribute" : "Upload";
  const mobileQuickUploadAriaLabel =
    browseMode === "advanced"
      ? "Contribute advanced resource"
      : "Upload programming notes";

  const navItemsBeforeMode = useMemo(
    () => [
      { id: "home", href: modeAwareHome, label: "Home" },
      { id: "browse", href: modeAwareBrowse.href, label: "Browse" },
      { id: "secondary", href: modeAwareSecondary.href, label: modeAwareSecondary.label },
    ],
    [modeAwareHome, modeAwareBrowse.href, modeAwareSecondary.href, modeAwareSecondary.label],
  );

  const navItemsAfterMode = useMemo(
    () => [
      { id: "videos", href: "/videos", label: "Video" },
      { id: "about", href: "/about", label: "About" },
    ],
    [],
  );

  const isItemActive = (href: string) => {
    const hrefPath = href.split("?")[0] || href;
    if (hrefPath === "/") return pathname === "/";
    
    // For home-like paths (e.g., /tracks in advanced mode), only match exactly
    // For other paths (e.g., /browse, /categories), match exactly or with a trailing slash
    if (pathname === hrefPath) return true;
    if (pathname.startsWith(hrefPath + "/")) return true;
    return false;
  };

  const handleHomeLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);

    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (event.defaultPrevented || isModifiedClick) return;

    const homeHref = "/home";
    if (pathname === homeHref) {
      event.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  };

  const handleProtectedActionClick = (
    event: MouseEvent<HTMLAnchorElement>,
    context: "upload" | "contribute"
  ) => {
    if (isAuthenticated) return;

    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (event.defaultPrevented || isModifiedClick) return;

    event.preventDefault();
    setLoginPromptContext(context);
    setLoginPromptOpen(true);
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header
        id="main-navbar"
        className={`${styles.header} ${scrolled ? styles.scrolled : ""} ${headerHidden ? styles.headerHidden : ""}`}
      >
      <nav className={styles.nav}>
        <Link href={modeAwareHome} className={styles.logo} id="nav-logo" onClick={handleHomeLogoClick}>
          <span className={styles.logoText}>xreso</span>
        </Link>

        <div className={styles.navLinks}>
          {navItemsBeforeMode.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              id={`nav-${item.id}`}
              className={`${styles.navLink} ${isItemActive(item.href) ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}

          <div className={styles.modeToggle} role="group" aria-label="Browse mode toggle">
            <Link
              href="/"
              className={`${styles.modeToggleBtn} ${browseMode === "programming" && !isHomeHubRoute ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
              aria-current={browseMode === "programming" && !isHomeHubRoute ? "page" : undefined}
            >
              Core Code
            </Link>
            <Link
              href="/tracks"
              className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
              aria-current={browseMode === "advanced" ? "page" : undefined}
            >
              Deep Tech
            </Link>
          </div>

          {navItemsAfterMode.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              id={`nav-${item.id}`}
              className={`${styles.navLink} ${isItemActive(item.href) ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}


        </div>

        <div className={styles.navActions}>
          <Link
            href={navUploadHref}
            className={`btn btn-primary btn-sm ${styles.uploadBtn}`}
            id="nav-upload"
            onClick={(event) => handleProtectedActionClick(event, "upload")}
          >
            Upload
          </Link>

          {isAuthenticated ? (
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

        <div className={styles.mobileHeaderActions}>
          <Link
            href={navMobileQuickUploadHref}
            className={styles.mobileQuickUpload}
            id="nav-mobile-upload"
            onClick={(event) => {
              handleProtectedActionClick(event, "contribute");
              if (isAuthenticated) {
                closeMobileMenu();
              }
            }}
            aria-label={mobileQuickUploadAriaLabel}
            title={mobileQuickUploadAriaLabel}
          >
            <span className={styles.mobileQuickUploadIcon} aria-hidden="true">
              {"</>"}
            </span>
            <span className={styles.mobileQuickUploadLabel}>{mobileQuickUploadLabel}</span>
          </Link>

          <button
            className={styles.mobileToggle}
            id="nav-mobile-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.open : ""}`} />
          </button>
        </div>
      </nav>

      <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ""}`}>
        <div className={styles.mobileBody}>
          <div className={styles.modeToggle} role="group" aria-label="Browse mode toggle">
            <Link
              href="/"
              className={`${styles.modeToggleBtn} ${browseMode === "programming" && !isHomeHubRoute ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
            >
              Core Code
            </Link>
            <Link
              href="/tracks"
              className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
              onClick={closeMobileMenu}
            >
              Deep Tech
            </Link>
          </div>

          {[...navItemsBeforeMode, ...navItemsAfterMode].map((item) => (
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
            href={navUploadHref}
            className={`btn btn-primary ${styles.mobileUpload}`}
            onClick={(event) => {
              handleProtectedActionClick(event, "upload");
              if (isAuthenticated) {
                closeMobileMenu();
              }
            }}
          >
            Upload Notes
          </Link>

          {isAuthenticated ? (
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

      {loginPromptOpen ? (
        <div
          className={styles.authPromptOverlay}
          onClick={() => setLoginPromptOpen(false)}
          aria-hidden="true"
        >
          <div
            className={styles.authPromptDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-first-title"
            aria-describedby="login-first-description"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.authPromptBadge}>Login Required</p>
            <h3 id="login-first-title" className={styles.authPromptTitle}>
              Login First
            </h3>
            <p id="login-first-description" className={styles.authPromptText}>
              {loginPromptMessage}
            </p>
            <div className={styles.authPromptActions}>
              <Link
                href={loginPromptHref}
                className={`btn btn-primary ${styles.authPromptPrimary}`}
                onClick={() => setLoginPromptOpen(false)}
              >
                Continue to Login
              </Link>
              <button
                type="button"
                className={`btn btn-ghost ${styles.authPromptSecondary}`}
                onClick={() => setLoginPromptOpen(false)}
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FloatingQuickNav hidden={shouldHideFloatingQuickNav} />
    </>
  );
}
