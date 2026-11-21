// supabase/functions/_shared/offer-checkout.ts
// Paramètres de la page de paiement Stripe d'une offre commerciale, partagés
// par generate-offer (création de l'offre) et open-offer (ouverture du lien
// par le prospect). Une Checkout Session Stripe expire au bout de 24 h : on
// n'envoie donc jamais son URL par e-mail, on envoie un lien
// swissbrokerpro.ch/offre/{token} qui en recrée une à chaque ouverture.

/** Durée de validité d'un lien d'offre envoyé à un prospect. */
export const OFFER_VALIDITY_DAYS = 30;

/** 24 octets aléatoires, encodés en base36 (32 caractères). */
export function randomOfferToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export function isOfferToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-z0-9]{32}$/.test(token);
}

export function offerCheckoutParams(opts: {
  priceId: string;
  leadEmail: string;
  demoRequestId: string;
  generatedBy: string | null;
  couponId: string | null;
  siteUrl: string;
}): Record<string, string> {
  // adaptive_pricing désactivé : tous les clients sont suisses, le Price
  // Stripe est en CHF, et sans ça Stripe peut convertir l'affichage vers
  // une autre devise (ex. EUR) selon la localisation du navigateur.
  const params: Record<string, string> = {
    "payment_method_types[0]": "card",
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    "adaptive_pricing[enabled]": "false",
    customer_email: opts.leadEmail,
    success_url: `${opts.siteUrl}/paiement-confirme`,
    cancel_url: `${opts.siteUrl}/`,
    // demo_request_id indispensable : le webhook de conversion
    // (handle-conversion) retrouve ainsi quel lead a payé.
    "metadata[demo_request_id]": opts.demoRequestId,
    "subscription_data[metadata][demo_request_id]": opts.demoRequestId,
  };
  if (opts.generatedBy) params["metadata[generated_by]"] = opts.generatedBy;
  if (opts.couponId) params["discounts[0][coupon]"] = opts.couponId;
  return params;
}
