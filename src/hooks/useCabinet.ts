// Situation du courtier connecté vis-à-vis d'un cabinet : patron, collaborateur
// ou indépendant. Lu une fois et partagé (react-query) par la navigation, le
// profil, la page cabinet et la liste des clients.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CabinetRole = "patron" | "collaborateur" | null;

export interface CabinetState {
  role: CabinetRole;
  rootId: string | null;
  cabinetName: string | null;
  cabinetAddress: string | null;
  /** Collaborateur : qui paie sa cotisation annuelle. */
  payer: "cabinet" | "self" | null;
}

const EMPTY: CabinetState = { role: null, rootId: null, cabinetName: null, cabinetAddress: null, payer: null };

export function useCabinet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["cabinet-state", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<CabinetState> => {
      const { data: me } = await supabase
        .from("profiles")
        .select("cabinet_role,cabinet_root_id,cabinet_payer")
        .eq("id", user!.id)
        .maybeSingle();
      if (!me?.cabinet_root_id || !me.cabinet_role) return EMPTY;
      const { data: cab } = await supabase
        .from("cabinets")
        .select("name,address")
        .eq("root_id", me.cabinet_root_id)
        .maybeSingle();
      if (!cab) return EMPTY;
      const role: CabinetRole =
        me.cabinet_role === "root_director" && me.cabinet_root_id === user!.id
          ? "patron"
          : me.cabinet_role === "courtier"
            ? "collaborateur"
            : null;
      return {
        role,
        rootId: me.cabinet_root_id,
        cabinetName: cab.name,
        cabinetAddress: cab.address,
        payer: (me.cabinet_payer as CabinetState["payer"]) ?? null,
      };
    },
  });
  return {
    ...(query.data ?? EMPTY),
    isLoading: query.isLoading,
    refresh: () => qc.invalidateQueries({ queryKey: ["cabinet-state"] }),
  };
}

/** Message lisible pour les codes d'erreur renvoyés par la fonction « cabinet ». */
export function cabinetErrorMessage(code: string | undefined): string {
  switch (code) {
    case "NAME_REQUIRED": return "Indiquez le nom et le prénom (ou le nom du cabinet).";
    case "EMAIL_INVALID": return "Adresse e-mail invalide.";
    case "PAYER_REQUIRED": return "Choisissez qui paie la cotisation.";
    case "SELF_INVITE": return "Vous ne pouvez pas vous inviter vous-même.";
    case "ALREADY_MEMBER": return "Cette personne fait déjà partie de votre cabinet.";
    case "ALREADY_IN_CABINET": return "Cette personne fait déjà partie d'un cabinet.";
    case "INVITE_EXISTS": return "Une invitation est déjà en cours pour cette adresse.";
    case "INVITE_EXPIRED":
    case "INVITE_NOT_FOUND": return "Cette invitation n'est plus valable. Demandez au cabinet de vous la renvoyer.";
    case "INVITE_USED": return "Cette invitation a déjà été utilisée.";
    case "WRONG_ACCOUNT": return "Vous êtes connecté avec une autre adresse que celle de l'invitation.";
    case "IS_PATRON": return "Vous êtes déjà responsable d'un cabinet.";
    case "ACCOUNT_EXISTS": return "Un compte existe déjà avec cette adresse : connectez-vous pour rejoindre le cabinet.";
    case "PASSWORD_TOO_SHORT": return "Le mot de passe doit contenir au moins 8 caractères.";
    case "NOT_PATRON": return "Action réservée au responsable du cabinet.";
    case "TRANSFER_FAILED": return "Le transfert des dossiers a échoué, rien n'a été modifié. Réessayez.";
    case "STRIPE_ERROR": return "Le paiement n'a pas pu être modifié chez Stripe. Réessayez.";
    default: return "Une erreur est survenue. Réessayez.";
  }
}

/** Appel de la fonction « cabinet » ; lève une Error au message lisible. */
export async function callCabinet<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cabinet", { body: { action, ...payload } });
  if (error) {
    let code: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      code = ctx ? (await ctx.json())?.error : undefined;
    } catch {
      code = undefined;
    }
    throw new Error(cabinetErrorMessage(code));
  }
  if ((data as { error?: string })?.error) throw new Error(cabinetErrorMessage((data as { error: string }).error));
  return data as T;
}
