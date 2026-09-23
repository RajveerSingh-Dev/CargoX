import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { RateTicker } from "@/components/ticker";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });
const instr = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instr" });

export const metadata: Metadata = {
  title: "Coromandel — Freight Intelligence",
  description:
    "Predictive dry-bulk chartering platform for India's East Coast: freight rate forecasting, vessel-port optimization, market entry timing, idle management and risk radar.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} ${instr.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans text-paper antialiased">
        {/* ambient background */}
        <div className="aurora pointer-events-none fixed inset-0 -z-20" />
        <div className="grid-bg pointer-events-none fixed inset-0 -z-10" />

        <Sidebar />

        <div className="md:pl-[236px]">
          {/* mobile bar */}
          <div className="sticky top-0 z-40 flex items-center gap-4 border-b border-line bg-ink-900/90 px-4 py-3 backdrop-blur-md md:hidden">
            <span className="text-[12px] font-bold tracking-[0.18em] text-paper">COROMANDEL</span>
            <nav className="flex flex-1 gap-1 overflow-x-auto">
             {[
                ["/", "Pulse"],
                ["/forecast", "Forecast"],
                ["/timing", "Timing"],
                ["/optimizer", "Optimizer"],
                ["/idle", "Idle"],
                ["/risk", "Risk"],
                ["/map", "Live Ops"],
                ["/chat", "Copilot AI"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-mist hover:bg-ink-800">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <Suspense fallback={<div className="h-[33px] border-b border-line bg-ink-900/70" />}>
            <RateTicker />
          </Suspense>
          <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-7 md:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
