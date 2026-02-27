import Link from "next/link";
import { MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#f0f4ff] dark:bg-[#050d1f] border-t border-black/[0.06] dark:border-white/[0.06]">
      <style suppressHydrationWarning>{`
        .footer-logo { font-family: 'Syne', sans-serif; }
      `}</style>
      <div className="container mx-auto px-6 py-8">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0C3E67] flex items-center justify-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/busicon.png" alt="" width={15} height={15} style={{ filter: "brightness(0) invert(1)" }} />
              </div>
              <span className="text-lg font-bold text-[#0C3E67] dark:text-white tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                DC Bus Route
              </span>
            </div>
            <p className="text-xs text-[#0C3E67]/45 dark:text-white/35 max-w-[200px] leading-relaxed">
              Your guide to navigating Davao City by bus.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0C3E67]/40 dark:text-white/30 mb-1">
              Creators
            </p>
            <div className="flex flex-col gap-1.5">
              {["Antonio De Jesus", "Kieffer Devera"].map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#0C3E67]/10 dark:bg-white/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[#0C3E67] dark:text-white/70">
                      {name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm text-[#0C3E67]/70 dark:text-white/60">{name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-7 pt-5 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-[#0C3E67]/30 dark:text-white/25">
            © {new Date().getFullYear()} DC Bus Route. Davao City Bus Route Guide.
          </p>
          <span className="flex items-center gap-1 text-[11px] text-[#0C3E67]/30 dark:text-white/25">
            <MapPin className="w-3 h-3" />
            Davao City, Philippines
          </span>
        </div>

      </div>
    </footer>
  );
}

export default Footer;