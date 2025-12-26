import React, { createContext, useContext } from "react";
import { useInternalZoom } from "@/hooks/useInternalZoom";

type ZoomContextValue = ReturnType<typeof useInternalZoom>;

const ZoomContext = createContext<ZoomContextValue | null>(null);

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  const value = useInternalZoom();
  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}

export function useZoom() {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error("useZoom must be used within ZoomProvider");
  return ctx;
}
