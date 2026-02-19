"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/route-map", label: "Route Map" },
  { href: "/chatbot", label: "AI Chatbot" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="bg-primary-600 text-white shadow-md sticky top-0 z-[9999]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/busicon.png"
                alt="DC Bus Route Logo"
                width={40}
                height={32}
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <span className="text-xl font-bold">DC Bus Route</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isActive(link.href)
                      ? "bg-primary-700 font-semibold border-b-2 border-white"
                      : "hover:bg-primary-500"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="ml-2 p-2 rounded-md hover:bg-primary-500 transition-colors"
                aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            </nav>

            {/* Mobile Controls */}
            <div className="md:hidden flex items-center gap-1">
              {/* Mobile Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md hover:bg-primary-500 transition-colors"
                aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              {/* Mobile Menu Button */}
              <button
                className="p-2 rounded-md hover:bg-primary-500 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu — rendered OUTSIDE <header> to escape its stacking context */}
      <div
        className={`fixed inset-0 z-[99999] md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Slide-out Panel */}
        <div
          className={`absolute top-16 right-0 w-64 h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <nav className="flex flex-col p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md transition-colors ${
                  isActive(link.href)
                    ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-semibold border-l-4 border-primary-600"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="mt-4 px-4 py-3 rounded-md flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="w-5 h-5" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}

export default Header;