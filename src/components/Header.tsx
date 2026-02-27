"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Moon, Map, MessageSquare } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const navLinks = [
  { href: "/", label: "Home", icon: null },
  { href: "/route-map", label: "Route Map", icon: Map },
  { href: "/chatbot", label: "AI Chatbot", icon: MessageSquare },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <style suppressHydrationWarning>{`
        .header-logo { font-family: 'Syne', sans-serif; }
        .nav-link-pill {
          position: relative;
          transition: color 0.2s;
        }
        .nav-link-pill::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 2px;
          border-radius: 2px;
          background: currentColor;
          transition: width 0.25s cubic-bezier(0.22,1,0.36,1), left 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .nav-link-pill:hover::after,
        .nav-link-pill.active::after {
          width: 100%;
          left: 0;
        }
        @keyframes menu-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mobile-menu-panel { animation: menu-in 0.22s cubic-bezier(0.22,1,0.36,1) forwards; }
        .theme-btn {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.2s;
        }
        .theme-btn:hover { transform: rotate(20deg) scale(1.1); }
      `}</style>

      <header className={`sticky top-0 z-[9999] transition-all duration-300 ${
        scrolled
          ? "bg-white/80 dark:bg-[#050d1f]/85 backdrop-blur-xl shadow-[0_1px_32px_rgba(12,62,103,0.10)] dark:shadow-[0_1px_32px_rgba(0,0,0,0.4)] border-b border-[#0C3E67]/08 dark:border-white/[0.06]"
          : "bg-white/60 dark:bg-[#050d1f]/60 backdrop-blur-md border-b border-transparent"
      }`}>
        <div className="container mx-auto px-5">
          <div className="flex items-center justify-between h-16">

            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 rounded-xl bg-[#0C3E67] dark:bg-white/10 group-hover:scale-105 transition-transform duration-200" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/busicon.png" alt="DC Bus Route Logo" width={22} height={22}
                  className="relative z-10" style={{ filter: "brightness(0) invert(1)" }} />
              </div>
              <span className="text-lg font-bold text-[#0C3E67] dark:text-white tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              DC Bus Route
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`nav-link-pill px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? "active text-[#0C3E67] dark:text-white bg-[#0C3E67]/08 dark:bg-white/10"
                      : "text-[#0C3E67]/60 dark:text-white/60 hover:text-[#0C3E67] dark:hover:text-white hover:bg-[#0C3E67]/05 dark:hover:bg-white/05"
                  }`}>
                  {link.label}
                </Link>
              ))}
              <div className="w-px h-5 bg-[#0C3E67]/15 dark:bg-white/15 mx-2" />
              <button onClick={toggleTheme}
                className="theme-btn w-9 h-9 flex items-center justify-center rounded-lg text-[#0C3E67]/70 dark:text-white/70 hover:text-[#0C3E67] dark:hover:text-white hover:bg-[#0C3E67]/08 dark:hover:bg-white/08"
                aria-label="Toggle theme">
                {resolvedTheme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>
            </nav>

            <div className="md:hidden flex items-center gap-1">
              <button onClick={toggleTheme}
                className="theme-btn w-9 h-9 flex items-center justify-center rounded-lg text-[#0C3E67]/70 dark:text-white/70"
                aria-label="Toggle theme">
                {resolvedTheme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#0C3E67] dark:text-white hover:bg-[#0C3E67]/08 dark:hover:bg-white/08 transition-colors"
                aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[99998] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-menu-panel absolute top-16 left-3 right-3 rounded-2xl overflow-hidden bg-white/95 dark:bg-[#0a1628]/95 backdrop-blur-xl border border-[#0C3E67]/10 dark:border-white/10 shadow-[0_20px_60px_rgba(12,62,103,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <nav className="p-3 flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive(link.href)
                        ? "bg-[#0C3E67] text-white shadow-sm"
                        : "text-[#0C3E67] dark:text-white/80 hover:bg-[#0C3E67]/08 dark:hover:bg-white/08"
                    }`}>
                    {Icon && <Icon className="w-4 h-4 opacity-70" />}
                    {link.label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-[#0C3E67]/08 dark:border-white/08" />
              <button onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#0C3E67] dark:text-white/80 hover:bg-[#0C3E67]/08 dark:hover:bg-white/08 transition-colors">
                {resolvedTheme === "dark"
                  ? <><Sun className="w-4 h-4 opacity-70" /><span>Light Mode</span></>
                  : <><Moon className="w-4 h-4 opacity-70" /><span>Dark Mode</span></>}
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;