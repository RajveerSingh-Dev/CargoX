"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem("cargox-theme");
    if (savedTheme === "light") {
      setIsLight(true);
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = (mode: "dark" | "light") => {
    const light = mode === "light";
    setIsLight(light);
    if (light) {
      document.documentElement.classList.add("light");
      localStorage.setItem("cargox-theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("cargox-theme", "dark");
    }
  };

  return (
    <div>
      <div className="eyebrow !text-[9px] mb-2 font-bold text-fog">APPEARANCE</div>
      <div className="flex w-fit items-center rounded-full border border-line bg-ink-800/60 p-1">
        <button
          type="button"
          onClick={() => toggleTheme("dark")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
            !isLight
              ? "bg-brand text-ink-950 shadow-sm"
              : "text-fog hover:text-paper"
          }`}
        >
          <Moon className="h-3 w-3" /> Dark
        </button>
        <button
          type="button"
          onClick={() => toggleTheme("light")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
            isLight
              ? "bg-brand text-ink-950 shadow-sm"
              : "text-fog hover:text-paper"
          }`}
        >
          <Sun className="h-3 w-3" /> Light
        </button>
      </div>
    </div>
  );
}