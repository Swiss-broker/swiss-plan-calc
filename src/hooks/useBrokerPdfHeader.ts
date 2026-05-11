// Hook centralisé : lit le profil courtier (identité + personnalisation PDF)
// et retourne un PdfHeaderInfo prêt à passer à toutes les fonctions export*Pdf.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BrokerHeader } from "@/lib/pdf/builder";

const DEFAULT_PRIMARY = "#0F4C81";
const DEFAULT_ACCENT = "#3B82F6";

export function useBrokerPdfHeader(): BrokerHeader {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BrokerHeader>({
    brokerEmail: user?.email ?? undefined,
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,brokerage_name,phone,pdf_primary_color,pdf_accent_color,pdf_footer_note,logo_url",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      // Charger le logo en base64 pour jsPDF (CORS-safe via fetch)
      let logoDataUrl: string | undefined;
      if (data.logo_url) {
        try {
          const resp = await fetch(data.logo_url);
          if (resp.ok) {
            const blob = await resp.blob();
            logoDataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = reject;
              r.readAsDataURL(blob);
            });
          }
        } catch {
          // logo inaccessible : on ignore silencieusement
        }
      }
      if (cancelled) return;
      setProfile({
        brokerName: fullName || undefined,
        brokerEmail: user.email ?? undefined,
        brokerPhone: data.phone ?? undefined,
        brokerageName: data.brokerage_name ?? undefined,
        primaryColor: data.pdf_primary_color ?? DEFAULT_PRIMARY,
        accentColor: data.pdf_accent_color ?? DEFAULT_ACCENT,
        footerNote: data.pdf_footer_note ?? undefined,
        logoDataUrl,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return profile;
}

/** Convertit "#RRGGBB" en tuple [r,g,b]. Tolérant sur la casse et les # manquants. */
export function hexToRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  return [r, g, b];
}
