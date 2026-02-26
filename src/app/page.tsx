"use client";

import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";

export default function Home() {
  return (
    <>
      <style suppressHydrationWarning>{`
        .hero-root { font-family: 'DM Sans', sans-serif; }
        .hero-title { font-family: 'Barlow', sans-serif; font-weight: 900; }
        .street-grid {
          background-image:
            linear-gradient(to right, rgba(12,62,103,0.12) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(12,62,103,0.12) 1.5px, transparent 1.5px),
            linear-gradient(to right, rgba(12,62,103,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(12,62,103,0.05) 1px, transparent 1px);
          background-size: 160px 160px, 160px 160px, 40px 40px, 40px 40px;
        }
        .dark .street-grid {
          background-image:
            linear-gradient(to right, rgba(74,158,221,0.14) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(74,158,221,0.14) 1.5px, transparent 1.5px),
            linear-gradient(to right, rgba(74,158,221,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(74,158,221,0.06) 1px, transparent 1px);
          background-size: 160px 160px, 160px 160px, 40px 40px, 40px 40px;
        }
        @keyframes grid-pan {
          from { background-position: 0 0, 0 0, 0 0, 0 0; }
          to   { background-position: 160px 160px, 160px 160px, 40px 40px, 40px 40px; }
        }
        .street-grid { animation: grid-pan 18s linear infinite; }
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.97); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.08); }
          66% { transform: translate(25px, -20px) scale(0.95); }
        }
        .orb-1 { animation: orb-drift 14s ease-in-out infinite; }
        .orb-2 { animation: orb-drift-2 18s ease-in-out infinite; }
        .orb-3 { animation: orb-drift 22s ease-in-out infinite reverse; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fade-up 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .fade-up-2 { animation: fade-up 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
        .fade-up-3 { animation: fade-up 0.7s cubic-bezier(0.22,1,0.36,1) 0.4s both; }
        .fade-up-4 { animation: fade-up 0.7s cubic-bezier(0.22,1,0.36,1) 0.55s both; }
        @keyframes soft-ping {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0; }
        }
        .pin-ring { animation: soft-ping 2.5s ease-in-out infinite; }
        @keyframes badge-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .badge-float { animation: badge-float 3.5s ease-in-out infinite; }
        .btn-primary { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(12,62,103,0.38); }
        .dark .btn-primary:hover { box-shadow: 0 14px 40px rgba(74,158,221,0.3); }
        .btn-secondary { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), background 0.15s; }
        .btn-secondary:hover { transform: translateY(-2px); }
        .btn-secondary .chevron { transition: transform 0.2s; }
        .btn-secondary:hover .chevron { transform: translateX(3px); }
      `}</style>

      <div className="hero-root relative min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center overflow-hidden px-6 bg-[#f0f4ff] dark:bg-[#050d1f]">

        <div className="street-grid absolute inset-0 pointer-events-none" />

        <div className="orb-1 absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_rgba(74,158,221,0.15)_0%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(13,59,110,0.30)_0%,_transparent_70%)] blur-3xl pointer-events-none z-[2]" />
        <div className="orb-2 absolute bottom-[-15%] right-[-8%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(12,62,103,0.10)_0%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(74,158,221,0.07)_0%,_transparent_70%)] blur-3xl pointer-events-none z-[2]" />
        <div className="orb-3 absolute top-[35%] right-[10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,_rgba(147,197,253,0.15)_0%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(30,58,95,0.22)_0%,_transparent_70%)] blur-2xl pointer-events-none z-[2]" />

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#f0f4ff] dark:from-[#050d1f] to-transparent pointer-events-none z-[4]" />

        <div className="relative text-center w-full max-w-5xl flex flex-col items-center" style={{ zIndex: 10 }}>

          <div className="badge-float fade-up-1 inline-flex items-center gap-2 mb-12 px-4 py-2 rounded-full bg-white/80 dark:bg-white/[0.07] border border-[#0C3E67]/15 dark:border-white/10 backdrop-blur-md shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="pin-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#0C3E67]/65 dark:text-white/55">
              Davao City Transit Guide
            </span>
          </div>

          <h1 className="hero-title fade-up-2 text-[clamp(2.8rem,7vw,5.5rem)] leading-[1.0] tracking-[-0.02em] whitespace-nowrap text-[#0a1628] dark:text-white">
            Navigate Davao City
          </h1>

          <h2 className="hero-title fade-up-3 text-[clamp(2.8rem,7vw,5.5rem)] leading-[1.0] tracking-[-0.02em] mt-5 whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-[#0C3E67] via-[#1a6bac] to-[#4a9edd] dark:from-[#4a9edd] dark:via-[#7ec8f0] dark:to-[#b8dff8]">
            With Ease.
          </h2>

          <p className="fade-up-3 mt-10 text-[15px] md:text-base text-[#0a1628]/45 dark:text-white/45 tracking-wide max-w-xs mx-auto leading-loose">
            Find your route. Know your stops. Never get lost again.
          </p>

          <div className="fade-up-4 mt-12 flex items-center justify-center gap-4 flex-wrap">
            <Link href="/route-map" className="btn-primary inline-flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-[#0C3E67] dark:bg-white text-white dark:text-[#0C3E67] text-[13px] font-semibold tracking-wide shadow-[0_8px_28px_rgba(12,62,103,0.32)]">
              <MapPin className="w-4 h-4" />
              Route Map
            </Link>
            <Link href="/chatbot" className="btn-secondary inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-white/60 dark:bg-white/[0.07] border border-[#0C3E67]/18 dark:border-white/12 backdrop-blur-md text-[#0C3E67] dark:text-white/80 text-[13px] font-semibold tracking-wide shadow-sm">
              AI Chatbot
              <ChevronRight className="chevron w-4 h-4 opacity-60" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}