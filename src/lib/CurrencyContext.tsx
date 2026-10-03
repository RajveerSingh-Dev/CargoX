"use client";
import { createContext, useContext, useState } from "react";

type Currency = "USD" | "INR";
const EXCHANGE_RATE = 84;

interface CurrencyContextType {
  currency: Currency;
  toggleCurrency: () => void;
  formatCurrency: (usdValue: number) => string;
  rate: number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("INR");

  const toggleCurrency = () => setCurrency((prev) => (prev === "INR" ? "USD" : "INR"));

  const formatCurrency = (usdValue: number) => {
    if (currency === "INR") {
      return `₹${Math.round(usdValue * EXCHANGE_RATE).toLocaleString("en-IN")}`;
    }
    return `$${Math.round(usdValue).toLocaleString("en-US")}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, toggleCurrency, formatCurrency, rate: EXCHANGE_RATE }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
};