"use client";

import { useState, useEffect } from "react";

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-screen bg-track-800 flex items-center justify-center"><span className="text-stone-400">Loading...</span></div>;
  return <>{children}</>;
}
