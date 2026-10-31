"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { WorkspaceConfig } from "@/lib/workspace/catalog";

type ActiveConfig = {
  config: WorkspaceConfig | null;
  previous: WorkspaceConfig | null;
  apply: (config: WorkspaceConfig) => void;
  undo: () => WorkspaceConfig | null;
};

const ActiveConfigContext = createContext<ActiveConfig | null>(null);
const storageKey = "aayaam-workspace-config";

export function ActiveConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [previous, setPrevious] = useState<WorkspaceConfig | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      setConfig(JSON.parse(saved) as WorkspaceConfig);
    } catch {
      setConfig(null);
    }
  }, []);

  const apply = (next: WorkspaceConfig) => {
    setPrevious(config);
    setConfig(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const undo = () => {
    const restored = previous;
    setConfig(restored);
    setPrevious(null);
    if (restored) window.localStorage.setItem(storageKey, JSON.stringify(restored));
    else window.localStorage.removeItem(storageKey);
    return restored;
  };

  return <ActiveConfigContext.Provider value={{ config, previous, apply, undo }}>{children}</ActiveConfigContext.Provider>;
}

export function useActiveConfig() {
  const value = useContext(ActiveConfigContext);
  if (!value) throw new Error("useActiveConfig must be used inside ActiveConfigProvider");
  return value;
}
