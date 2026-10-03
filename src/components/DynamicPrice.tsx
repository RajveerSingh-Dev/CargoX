"use client";

import { useCurrency } from "@/lib/CurrencyContext";

export function DynamicPrice({ value, compact = false }: { value: number; compact?: boolean }) {
  const { currency, rate } = useCurrency();

  if (currency === "INR") {
    const inr = value * rate;
    if (compact) {
      if (inr >= 10000000) return `₹${(inr / 10000000).toFixed(2)} Cr`;
      if (inr >= 100000) return `₹${(inr / 100000).toFixed(1)}L`;
    }
    return `₹${Math.round(inr).toLocaleString("en-IN")}`;
  }

  // USD Formatting
  if (compact) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}