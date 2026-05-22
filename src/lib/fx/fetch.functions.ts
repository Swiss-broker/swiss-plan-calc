// Server function, récupère les taux journaliers de référence.
//
// Source primaire : api.frankfurter.app (proxy gratuit ECB, sans clé).
// Convertit toutes les devises en CHF (1 unit FOREIGN = X CHF).
// Si la date tombe un week-end ou un jour férié bancaire (réponse vide),
// on retombe automatiquement sur le jour ouvrable précédent (jusqu'à 5 jours).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(60),
  currency: z.enum(["EUR", "USD", "GBP", "CAD", "JPY"]),
});

export interface FxRateEntry {
  date: string;
  /** Date effectivement retenue (jour ouvrable précédent si week-end). */
  effectiveDate?: string;
  rate: number | null;
  source: "ECB" | "fallback";
  error?: string;
}

function shiftDay(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

async function fetchOne(
  date: string,
  currency: string,
): Promise<{ rate: number | null; effectiveDate: string }> {
  const url = `https://api.frankfurter.app/${date}?from=${currency}&to=CHF`;
  const res = await fetch(url);
  if (!res.ok) return { rate: null, effectiveDate: date };
  const json = (await res.json()) as { date?: string; rates?: { CHF?: number } };
  const rate = json.rates?.CHF;
  if (typeof rate !== "number") return { rate: null, effectiveDate: date };
  return {
    rate: Math.round(rate * 10000) / 10000,
    effectiveDate: json.date ?? date,
  };
}

export const fetchMarketRates = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<FxRateEntry[]> => {
    const { dates, currency } = data;
    const results = await Promise.all(
      dates.map(async (date): Promise<FxRateEntry> => {
        try {
          // Tente le jour demandé puis recule jusqu'à 5 jours (week-end / férié).
          for (let i = 0; i <= 5; i++) {
            const tryDate = i === 0 ? date : shiftDay(date, -i);
            const { rate, effectiveDate } = await fetchOne(tryDate, currency);
            if (rate !== null) {
              return {
                date,
                effectiveDate: effectiveDate !== date ? effectiveDate : undefined,
                rate,
                source: "ECB",
              };
            }
          }
          return { date, rate: null, source: "fallback", error: "no_rate_within_5d" };
        } catch (e) {
          return {
            date,
            rate: null,
            source: "fallback",
            error: e instanceof Error ? e.message : "unknown",
          };
        }
      }),
    );
    return results;
  });
