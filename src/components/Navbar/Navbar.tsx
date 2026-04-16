"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Logo from "../Logo";
import styles from "./Navbar.module.css";

interface MegaMenuItem {
  id: string;
  label: string;
  href: string;
  description?: string;
  count?: number;
}

type BrowseMode = "programming" | "advanced";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [discoverItems, setDiscoverItems] = useState<MegaMenuItem[]>([]);
  const [advancedItems, setAdvancedItems] = useState<MegaMenuItem[]>([]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [userMenuOpen]);

  useEffect(() => {
    const handleClick = () => setMegaMenuOpen(false);
    if (megaMenuOpen) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [megaMenuOpen]);

  useEffect(() => {
    let active = true;

    async function fetchProfileAvatar() {
      if (!session?.user?.id) {
        if (active) setProfileAvatar(null);
        return;
      }

      const sessionAvatar =
        typeof session.user.image === "string" && session.user.image.trim().length > 0
          ? session.user.image
          : null;

      if (sessionAvatar) {
        if (active) setProfileAvatar(sessionAvatar);
        return;
      }

      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const nextAvatar =
          data &&
          data.user &&
          typeof data.user.avatar === "string" &&
          data.user.avatar.trim().length > 0
            ? data.user.avatar
            : null;

        if (active) {
          setProfileAvatar(nextAvatar);
        }
      } catch {
        // Keep fallback avatar from session if profile fetch fails.
      }
    }

    fetchProfileAvatar();
    return () => {
      active = false;
    };
  }, [session?.user?.id, session?.user?.image]);

  useEffect(() => {
    let active = true;

    async function loadMegaMenu() {
      try {
        const [discoverRes, advancedRes] = await Promise.all([
          fetch("/api/navigation/discover", { cache: "no-store" }),
          fetch("/api/navigation/advanced-tracks", { cache: "no-store" }),
        ]);

        if (!discoverRes.ok || !advancedRes.ok) {
          return;
        }

        const discoverPayload = (await discoverRes.json()) as {
          items?: MegaMenuItem[];
        };
        const advancedPayload = (await advancedRes.json()) as {
          items?: MegaMenuItem[];
        };

        if (!active) return;

        setDiscoverItems(discoverPayload.items || []);
        setAdvancedItems(advancedPayload.items || []);
      } catch {
        // Keep static fallbacks below if request fails.
      }
    }

    loadMegaMenu();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/tracks");
    router.prefetch("/browse");
    router.prefetch("/tracks/library");
  }, [router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mobileMenuOpen]);

  const userRole = (session?.user as { role?: string })?.role;
  const isDark = theme === "dark";
  const resolvedAvatar = profileAvatar || session?.user?.image || null;

  const discoverFallback: MegaMenuItem[] = [
    { id: "discover-all-notes", label: "All Notes", href: "/browse" },
    { id: "discover-categories", label: "Categories", href: "/categories" },
    {
      id: "discover-featured",
      label: "Featured Notes",
      href: "/browse?featured=true",
    },
  ];

  const advancedFallback: MegaMenuItem[] = [
    { id: "advanced-library", label: "Open Tracks Library", href: "/tracks/library" },
    {
      id: "advanced-kubernetes",
      label: "Kubernetes Notes",
      href: "/tracks/notes?track=kubernetes",
    },
    {
      id: "advanced-devops",
      label: "DevOps Notes",
      href: "/tracks/notes?track=devops",
    },
    {
      id: "advanced-system-design",
      label: "System Design Notes",
      href: "/tracks/notes?track=system-design",
    },
  ];

  const discoverMenu = discoverItems.length > 0 ? discoverItems : discoverFallback;
  const advancedMenu = advancedItems.length > 0 ? advancedItems : advancedFallback;
  const browseModeFromQuery: BrowseMode | null =
    searchParams.get("mode") === "advanced"
      ? "advanced"
      : searchParams.get("mode") === "programming"
        ? "programming"
        : null;
  const browseMode: BrowseMode = pathname.startsWith("/tracks")
    ? "advanced"
    : browseModeFromQuery || "programming";
  const uploadHref = browseMode === "advanced" ? "/upload?mode=advanced" : "/upload?mode=programming";
  const browseModeConfig: Record<
    BrowseMode,
    {
      title: string;
      menu: MegaMenuItem[];
      browseHref: string;
      browseLabel: string;
      secondaryHref: string;
      secondaryLabel: string;
    }
  > = {
    programming: {
      title: "Programming",
      menu: discoverMenu,
      browseHref: "/browse",
      browseLabel: "Browse Programming Notes",
      secondaryHref: "/categories",
      secondaryLabel: "Categories",
    },
    advanced: {
      title: "Advanced",
      menu: advancedMenu,
      browseHref: "/tracks",
      browseLabel: "Browse Advanced Notes",
      secondaryHref: "/tracks/library",
      secondaryLabel: "Categories",
    },
  };

  const activeBrowseMode = browseModeConfig[browseMode];

  const handleHomeLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setMegaMenuOpen(false);

    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const isNonPrimaryClick = event.button !== 0;

    // Let browser handle new-tab and modified clicks naturally.
    if (event.defaultPrevented || isModifiedClick || isNonPrimaryClick) {
      return;
    }

    if (pathname === "/") {
      event.preventDefault();
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0 });
      root.style.scrollBehavior = previousScrollBehavior;
    }
  };

  return (
    <header
      className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}
      id="main-navbar"
    >
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} id="nav-logo" onClick={handleHomeLogoClick}>
          <Logo className={styles.logoIcon} />
          <span className={styles.logoText}>xreso</span>
        </Link>

        <div className={styles.navLinks}>
          <div
            className={styles.megaMenuWrap}
            onMouseEnter={() => setMegaMenuOpen(true)}
            onMouseLeave={() => setMegaMenuOpen(false)}
          >
            <button
              className={styles.navLink}
              id="nav-browse"
              onClick={(e) => {
                e.stopPropagation();
                setMegaMenuOpen(!megaMenuOpen);
              }}
              aria-expanded={megaMenuOpen}
              aria-haspopup="menu"
            >
              Browse
            </button>

            {megaMenuOpen && (
              <div className={styles.megaMenu} role="menu">
                <div className={styles.megaMenuInner}>
                  <div className={styles.megaColumn}>
                    <p className={styles.megaTitle}>{activeBrowseMode.title}</p>
                    <div className={styles.megaList}>
                      {activeBrowseMode.menu.map((item) => (
                        <Link key={item.id} href={item.href} className={styles.megaItem}>
                          <span>{item.label}</span>
                          {typeof item.count === "number" ? (
                            <span className={styles.megaItemCount}>{item.count}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link
            href={activeBrowseMode.secondaryHref}
            className={`${styles.navLink} ${styles.modeAwareLink}`}
            id={browseMode === "advanced" ? "nav-tracks" : "nav-categories"}
          >
            {activeBrowseMode.secondaryLabel}
          </Link>
          <div className={styles.modeToggle} role="group" aria-label="Browse mode toggle">
            <Link
              href="/"
              className={`${styles.modeToggleBtn} ${browseMode === "programming" ? styles.modeToggleBtnActive : ""}`}
              id="nav-mode-programming"
              onClick={() => {
                setMobileMenuOpen(false);
                setMegaMenuOpen(false);
              }}
              aria-current={browseMode === "programming" ? "page" : undefined}
            >
              Programming
            </Link>
            <Link
              href="/tracks"
              className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
              id="nav-mode-advanced"
              onClick={() => {
                setMobileMenuOpen(false);
                setMegaMenuOpen(false);
              }}
              aria-current={browseMode === "advanced" ? "page" : undefined}
            >
              Advanced
            </Link>
          </div>
          <Link href="/about" className={styles.navLink} id="nav-about">
            About
          </Link>
        </div>

        <div className={styles.navActions}>
          <Link
            href={uploadHref}
            className={`btn btn-primary btn-sm ${styles.uploadBtn}`}
            id="nav-upload"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </Link>

          {status === "loading" ? (
            <div className={styles.userMenu} aria-hidden="true">
              <div className={`${styles.userAvatar} ${styles.userAvatarLoading}`} />
            </div>
          ) : session?.user ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userAvatar}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                id="nav-user-menu"
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
              {userMenuOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownName}>
                      {session.user.name}
                    </span>
                    <span className={styles.dropdownEmail}>
                      {session.user.email}
                    </span>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link href="/profile" className={styles.dropdownItem}>
                    My Profile
                  </Link>
                  <Link href="/profile?tab=bookmarks" className={styles.dropdownItem}>
                    Bookmarks
                  </Link>
                  {userRole === "admin" && (
                    <Link href="/admin" className={styles.dropdownItem}>
                      Admin Dashboard
                    </Link>
                  )}
                  <div className={styles.dropdownDivider} />

                  {/* ── Theme Toggle (inside dropdown) ── */}
                  <button
                    className={`${styles.dropdownItem} ${styles.themeRow}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(isDark ? "light" : "dark");
                    }}
                    id="theme-toggle"
                  >
                    <span className={styles.themeLabel}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      Toggle Theme
                    </span>
                    <span className={styles.themeToggleTrack} data-active={isDark ? "false" : "true"}>
                      <span className={styles.themeToggleThumb} />
                    </span>
                  </button>

                  <div className={styles.dropdownDivider} />
                  <button
                    className={styles.dropdownItem}
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className={`btn btn-ghost btn-sm ${styles.loginBtn}`}
              id="nav-login"
            >
              Sign In
            </Link>
          )}
        </div>

        <button
          className={styles.mobileToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
          id="nav-mobile-toggle"
        >
          <span
            className={`${styles.hamburger} ${mobileMenuOpen ? styles.open : ""}`}
          />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ""}`}
      >
        <div className={`${styles.modeToggle} ${styles.mobileModeToggle}`} role="group" aria-label="Browse mode toggle">
          <Link
            href="/"
            className={`${styles.modeToggleBtn} ${browseMode === "programming" ? styles.modeToggleBtnActive : ""}`}
            onClick={() => {
              setMobileMenuOpen(false);
              setMegaMenuOpen(false);
            }}
            aria-current={browseMode === "programming" ? "page" : undefined}
          >
            Programming
          </Link>
          <Link
            href="/tracks"
            className={`${styles.modeToggleBtn} ${browseMode === "advanced" ? styles.modeToggleBtnActive : ""}`}
            onClick={() => {
              setMobileMenuOpen(false);
              setMegaMenuOpen(false);
            }}
            aria-current={browseMode === "advanced" ? "page" : undefined}
          >
            Advanced
          </Link>
        </div>
        <Link
          href={activeBrowseMode.browseHref}
          className={styles.mobileLink}
          onClick={() => setMobileMenuOpen(false)}
        >
          {activeBrowseMode.browseLabel}
        </Link>
        <Link
          href={activeBrowseMode.secondaryHref}
          className={styles.mobileLink}
          onClick={() => setMobileMenuOpen(false)}
        >
          {activeBrowseMode.secondaryLabel}
        </Link>
        <Link
          href="/about"
          className={styles.mobileLink}
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </Link>
        <div className={styles.mobileDivider} />

        {/* Mobile theme toggle */}
        <button
          className={styles.mobileLink}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          Toggle Theme
        </button>

        <div className={styles.mobileDivider} />
        <Link
          href={uploadHref}
          className={`btn btn-primary ${styles.mobileUpload}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Upload Notes
        </Link>
        {status === "loading" ? (
          <div className={styles.mobileDivider} />
        ) : session?.user ? (
          <>
            <Link
              href="/profile"
              className={`btn btn-secondary ${styles.mobileLogin}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              My Profile
            </Link>
            <button
              className={`btn btn-ghost ${styles.mobileLogin}`}
              onClick={() => {
                setMobileMenuOpen(false);
                signOut({ callbackUrl: "/" });
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className={`btn btn-secondary ${styles.mobileLogin}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
