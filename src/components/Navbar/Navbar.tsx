"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import XresoLogo from "@/components/XresoLogo/XresoLogo";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

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

  const userRole = (session?.user as { role?: string })?.role;
  const isDark = theme === "dark";

  return (
    <header
      className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}
      id="main-navbar"
    >
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} id="nav-logo">
          <XresoLogo size={34} />
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
                    <p className={styles.megaTitle}>Discover</p>
                    <Link href="/browse" className={styles.megaItem}>All Notes</Link>
                    <Link href="/categories" className={styles.megaItem}>Categories</Link>
                    <Link href="/browse?sort=featured" className={styles.megaItem}>Featured Notes</Link>
                  </div>
                  <div className={styles.megaColumn}>
                    <p className={styles.megaTitle}>Cloud Native Tracks</p>
                    <Link href="/browse?q=kubernetes" className={styles.megaItem}>Kubernetes</Link>
                    <Link href="/browse?q=devops" className={styles.megaItem}>DevOps</Link>
                    <Link href="/browse?q=system+design" className={styles.megaItem}>System Design</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link href="/categories" className={styles.navLink} id="nav-categories">
            Categories
          </Link>
          <Link href="/about" className={styles.navLink} id="nav-about">
            About
          </Link>
        </div>

        <div className={styles.navActions}>
          <Link
            href="/upload"
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
            <div
              className={styles.userAvatar}
              style={{ opacity: 0.5, animation: "pulse 1.5s infinite" }}
              aria-hidden="true"
            />
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
                {session.user.name?.charAt(0).toUpperCase() || "U"}
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
        <Link
          href="/browse"
          className={styles.mobileLink}
          onClick={() => setMobileMenuOpen(false)}
        >
          Browse Notes
        </Link>
        <Link
          href="/categories"
          className={styles.mobileLink}
          onClick={() => setMobileMenuOpen(false)}
        >
          Categories
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
          href="/upload"
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
