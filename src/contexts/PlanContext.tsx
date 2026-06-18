import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BrokerPlan = "trial" | "starter" | "pro" | "cabinet" | "expired" | "free" | "internal";

export interface PlanLimits {
  maxClients: number | null;     // null = illimité
  maxCompanies: number | null;
  maxPdfPerMonth: number | null;
  maxAiPerDay: number | null;
}

export const PLAN_LIMITS: Record<BrokerPlan, PlanLimits> = {
  trial:    { maxClients: 20,   maxCompanies: 4,    maxPdfPerMonth: null, maxAiPerDay: null },
  starter:  { maxClients: 10,   maxCompanies: 2,    maxPdfPerMonth: 10,   maxAiPerDay: 10   },
  pro:      { maxClients: 20,   maxCompanies: 4,    maxPdfPerMonth: null, maxAiPerDay: null },
  cabinet:  { maxClients: null, maxCompanies: null, maxPdfPerMonth: null, maxAiPerDay: null },
  expired:  { maxClients: 0,    maxCompanies: 0,    maxPdfPerMonth: 0,    maxAiPerDay: 0    },
  free:     { maxClients: 0,    maxCompanies: 0,    maxPdfPerMonth: 0,    maxAiPerDay: 0    },
  internal: { maxClients: null, maxCompanies: null, maxPdfPerMonth: null, maxAiPerDay: null },
};

export interface PlanState {
  plan: BrokerPlan;
  limits: PlanLimits;
  isLoading: boolean;
  isExpired: boolean;
  canAddClient: (currentCount: number) => boolean;
  canAddCompany: (currentCount: number) => boolean;
}

const PlanContext = createContext<PlanState | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<BrokerPlan>("trial");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.plan) setPlan(data.plan as BrokerPlan);
        setIsLoading(false);
      });
  }, [user, isAuthenticated]);

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial;

  const value: PlanState = {
    plan,
    limits,
    isLoading,
    isExpired: plan === "expired" || plan === "free",
    canAddClient: (count) => limits.maxClients === null || count < limits.maxClients,
    canAddCompany: (count) => limits.maxCompanies === null || count < limits.maxCompanies,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
