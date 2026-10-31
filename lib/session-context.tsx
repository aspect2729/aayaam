"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type SessionView = {
  signedIn: boolean;
  mode: "demo" | "account";
  name: string;
  role: string;
  ready: boolean;
  refresh: () => void;
};

const SessionContext = createContext<SessionView | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<Omit<SessionView, "refresh">>({
    signedIn: false,
    mode: "demo",
    name: "Rohan",
    role: "Founder",
    ready: false,
  });

  const refresh = () => {
    void fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.name) {
          setView({ signedIn: false, mode: "demo", name: "Rohan", role: "Founder", ready: true });
          return;
        }
        setView({
          signedIn: Boolean(body.signedIn),
          mode: body.mode === "account" ? "account" : "demo",
          name: body.name,
          role: body.role || "Founder",
          ready: true,
        });
      })
      .catch(() => setView({ signedIn: false, mode: "demo", name: "Rohan", role: "Founder", ready: true }));
  };

  useEffect(() => {
    refresh();
  }, []);

  return <SessionContext.Provider value={{ ...view, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
