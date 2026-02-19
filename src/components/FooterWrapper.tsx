"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";

// Pages where footer should be hidden
const HIDE_FOOTER_PATHS = ["/route-map", "/navigate"];

export function FooterWrapper() {
  const pathname = usePathname();

  // Hide footer on specific pages
  const shouldHideFooter = HIDE_FOOTER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (shouldHideFooter) {
    return null;
  }

  return <Footer />;
}
