"use client";

import { useCurrency } from "@/lib/CurrencyContext";
import clsx from "clsx";

export function CurrencyToggle() {
  const { currency, toggleCurrency } = useCurrency();

  return (
    <div className="mb-4">
      <p className="eyebrow mb-2">Currency</p>
      <div className="flex rounded-full border border-line bg-ink-800/60 p-1">
        <button
          onClick={() => currency !== "USD" && toggleCurrency()}
          className={clsx(
            "flex-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
            currency === "USD" ? "bg-brand text-ink-950" : "text-fog hover:text-mist"
          )}
        >
          $ USD
        </button>
        <button
          onClick={() => currency !== "INR" && toggleCurrency()}
          className={clsx(
            "flex-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
            currency === "INR" ? "bg-brand text-ink-950" : "text-fog hover:text-mist"
          )}
        >
          ₹ INR
        </button>
      </div>
    </div>
  );
}