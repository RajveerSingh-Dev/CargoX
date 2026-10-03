"use client";

import { useCurrency } from "@/lib/CurrencyContext"; // Adjust path if it is in /contexts

export function FormatPrice({ value }: { value: number }) {
  const { formatCurrency } = useCurrency();
  return <>{formatCurrency(value)}</>;
}