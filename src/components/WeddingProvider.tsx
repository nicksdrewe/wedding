"use client";

import { createContext, useContext } from "react";
import { FALLBACK_NAMES, type WeddingNames } from "@/lib/wedding/names";

// The current wedding's names for client components (the server reads them
// with getCurrentWedding; see app/layout.tsx).
const WeddingContext = createContext<WeddingNames>(FALLBACK_NAMES);

export function WeddingProvider({ names, children }: { names: WeddingNames; children: React.ReactNode }) {
  return <WeddingContext.Provider value={names}>{children}</WeddingContext.Provider>;
}

export function useWedding() {
  return useContext(WeddingContext);
}
