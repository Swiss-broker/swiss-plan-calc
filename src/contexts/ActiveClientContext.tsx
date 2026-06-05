import { createContext, useContext, useState, type ReactNode } from "react";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";

interface ActiveClientBundle {
  client: Client;
  pension: ClientPension | null;
  assets: ClientAssets | null;
}

interface ActiveClientState {
  activeClient: Client | null;
  activeBundle: ActiveClientBundle | null;
  setActiveClient: (client: Client | null) => void;
  setActiveBundle: (bundle: ActiveClientBundle | null) => void;
}

const ActiveClientContext = createContext<ActiveClientState | null>(null);

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeBundle, setActiveBundle] = useState<ActiveClientBundle | null>(null);

  return (
    <ActiveClientContext.Provider value={{ activeClient, setActiveClient, activeBundle, setActiveBundle }}>
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  const ctx = useContext(ActiveClientContext);
  if (!ctx) throw new Error("useActiveClient must be used within ActiveClientProvider");
  return ctx;
}
