import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
export type BrokerPlan = "trial" | "starter" | "pro" | "cabinet" | "expired" | "free" | "internal";
export type CabinetRole = "root_director" | "director" | "courtier" | null;
export interface PlanLimits {
  maxClients: number | null;     // null = illimité
  maxCompanies: number | null;
  maxPdfPerMonth: number | null;
  maxAiPerDay: number | null;
}
export const PLAN_LIMITS: Record<BrokerPlan, PlanLimits> = {
  trial:    { maxClients: 20,   maxCompanies: 4,    maxPdfPerMonth: null, maxAiPerDay: null },
  starter:  { maxClients: 10,   maxCompanies: 2,    maxPdfPerMonth: null, maxAiPerDay: null },
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
  // Rôle dans la hiérarchie cabinet, null si le compte n'appartient à aucun
  // cabinet (Starter, Pro, comptes individuels classiques).
  cabinetRole: CabinetRole;
  // Vrai pour root_director et director : sert à afficher ou non l'onglet
  // Équipe et à accéder au dashboard équipe.
  canManageTeam: boolean;
}
const PlanContext = createContext<PlanState | null>(null);
export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<BrokerPlan>("trial");
  const [cabinetRole, setCabinetRole] = useState<CabinetRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }
    // Charge le plan et le rôle cabinet depuis Supabase
    const loadPlan = () => {
      supabase
        .from("profiles")
        .select("plan,cabinet_role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.plan) setPlan(data.plan as BrokerPlan);
          setCabinetRole((data?.cabinet_role as CabinetRole) ?? null);
          setIsLoading(false);
        });
    };
    loadPlan();
    // Recharge en temps réel si la base change (plan ou rôle cabinet)
    const channel = supabase
      .channel("plan-changes")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new?.plan) setPlan(payload.new.plan as BrokerPlan);
        if ("cabinet_role" in (payload.new ?? {})) {
          setCabinetRole((payload.new.cabinet_role as CabinetRole) ?? null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAuthenticated]);
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial;
  const value: PlanState = {
    plan,
    limits,
    isLoading,
    isExpired: plan === "expired" || plan === "free",
    // count = nombre de créations ce mois-ci uniquement
    canAddClient: (count) => limits.maxClients === null || count < limits.maxClients,
    canAddCompany: (count) => limits.maxCompanies === null || count < limits.maxCompanies,
    cabinetRole,
    canManageTeam: cabinetRole === "root_director" || cabinetRole === "director" || plan === "internal",
  };
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}