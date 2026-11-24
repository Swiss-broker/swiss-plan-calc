// Outils partagés du système cabinet (fonction « cabinet » et stripe-webhook).
// Aucun accès au navigateur : uniquement la clé de service, côté serveur.

export type Svc = { supabaseUrl: string; supabaseKey: string };

export function svcHeaders(svc: Svc, extra: Record<string, string> = {}) {
  return {
    apikey: svc.supabaseKey,
    Authorization: `Bearer ${svc.supabaseKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Requête PostgREST avec la clé de service ; renvoie le JSON (ou null). */
export async function rest<T = unknown>(
  svc: Svc,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${svc.supabaseUrl}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: svcHeaders(svc, init.prefer ? { Prefer: init.prefer } : {}),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INVITE_VALIDITY_DAYS = 14;

export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function inviteExpiry(now = Date.now()): string {
  return new Date(now + INVITE_VALIDITY_DAYS * 24 * 3600 * 1000).toISOString();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBrevo(
  brevoKey: string | undefined,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<boolean> {
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, email non envoyé");
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "SwissBroker Pro", email: "noreply@swissbrokerpro.ch" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) console.error("Brevo", res.status, await res.text());
  return res.ok;
}

export function cabinetInviteEmail(opts: {
  firstName: string;
  cabinetName: string;
  patronName: string;
  payer: "cabinet" | "self";
  link: string;
}): { subject: string; html: string } {
  const cab = escapeHtml(opts.cabinetName);
  const subject = `${opts.cabinetName} vous invite sur SwissBroker Pro`;
  const payLine =
    opts.payer === "cabinet"
      ? "Votre cotisation annuelle est prise en charge par le cabinet : vous n'avez rien à payer."
      : "Votre cotisation annuelle SwissBroker Pro reste à votre charge ; vous pourrez la régler depuis votre compte.";
  const html = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color:#0f172a;">
    <h2 style="color:#0f766e; margin:0 0 16px;">Rejoignez le cabinet ${cab}</h2>
    <p>Bonjour ${escapeHtml(opts.firstName)},</p>
    <p>${escapeHtml(opts.patronName)} vous invite à rejoindre le cabinet <strong>${cab}</strong> sur SwissBroker Pro.</p>
    <p>${payLine}</p>
    <p>Les rendez-vous que vous facturez à vos clients sont encaissés directement sur le compte du cabinet : vous n'avez pas de coordonnées bancaires à fournir.</p>
    <p style="margin:28px 0;">
      <a href="${opts.link}" style="background:#0f766e; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Rejoindre le cabinet</a>
    </p>
    <p style="font-size:13px; color:#475569;">Ce lien est valable ${INVITE_VALIDITY_DAYS} jours. S'il a expiré, demandez à ${escapeHtml(opts.patronName)} de vous le renvoyer.</p>
    <p style="color:#94a3b8; font-size:12px;">SwissBroker Pro</p>
  </div>`;
  return { subject, html };
}

/** Envoie (ou renvoie) l'e-mail d'invitation d'une ligne cabinet_invites. */
export async function sendCabinetInvite(
  svc: Svc,
  brevoKey: string | undefined,
  siteUrl: string,
  invite: { cabinet_root_id: string; email: string; first_name: string | null; payer: "cabinet" | "self"; token: string },
): Promise<boolean> {
  const [cab, root] = await Promise.all([
    rest<Array<{ name: string }>>(svc, `cabinets?root_id=eq.${invite.cabinet_root_id}&select=name`),
    rest<Array<{ first_name: string | null; last_name: string | null }>>(
      svc,
      `profiles?id=eq.${invite.cabinet_root_id}&select=first_name,last_name`,
    ),
  ]);
  const cabinetName = cab.data?.[0]?.name ?? "votre cabinet";
  const r = root.data?.[0];
  const patronName = `${r?.first_name ?? ""} ${r?.last_name ?? ""}`.trim() || cabinetName;
  const { subject, html } = cabinetInviteEmail({
    firstName: invite.first_name ?? "",
    cabinetName,
    patronName,
    payer: invite.payer,
    link: `${siteUrl}/rejoindre-cabinet/${invite.token}`,
  });
  return sendBrevo(brevoKey, invite.email, subject, html);
}

async function stripe(stripeKey: string, path: string, params?: Record<string, string>, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params || method === "DELETE" ? method : "GET",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function stripeGet(stripeKey: string, path: string) {
  return stripe(stripeKey, path, undefined, "GET");
}
export async function stripePost(stripeKey: string, path: string, params: Record<string, string>) {
  return stripe(stripeKey, path, params, "POST");
}
export async function stripeDelete(stripeKey: string, path: string) {
  return stripe(stripeKey, path, undefined, "DELETE");
}

/**
 * Un indépendant qui rejoint un cabinet qui paie pour lui : sa propre
 * cotisation n'est pas renouvelée (elle reste valable jusqu'à son échéance).
 * Les sièges payés par un cabinet (metadata kind=cabinet_seat) ne sont
 * jamais touchés ici.
 */
export async function stopOwnRenewals(stripeKey: string, email: string): Promise<number> {
  if (!stripeKey || !email) return 0;
  const customers = await stripeGet(stripeKey, `customers?email=${encodeURIComponent(email)}&limit=10`);
  let stopped = 0;
  for (const c of (customers.data?.data ?? []) as Array<{ id: string }>) {
    const subs = await stripeGet(stripeKey, `subscriptions?customer=${c.id}&status=active&limit=20`);
    for (const s of (subs.data?.data ?? []) as Array<{ id: string; cancel_at_period_end: boolean; metadata?: Record<string, string> }>) {
      if (s.metadata?.kind === "cabinet_seat" || s.cancel_at_period_end) continue;
      const r = await stripePost(stripeKey, `subscriptions/${s.id}`, { cancel_at_period_end: "true" });
      if (r.ok) stopped++;
    }
  }
  return stopped;
}

/** Session Stripe Checkout d'un siège payé par le cabinet (abonnement annuel). */
export async function createSeatCheckout(opts: {
  stripeKey: string;
  priceId: string;
  siteUrl: string;
  patronEmail: string | null;
  rootId: string;
  inviteId?: string;
  memberId?: string;
}): Promise<{ url: string; id: string }> {
  const meta: Record<string, string> = {
    kind: "cabinet_seat",
    cabinet_root_id: opts.rootId,
    ...(opts.inviteId ? { cabinet_invite_id: opts.inviteId } : {}),
    ...(opts.memberId ? { cabinet_member_id: opts.memberId } : {}),
  };
  const params: Record<string, string> = {
    "payment_method_types[0]": "card",
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: opts.rootId,
    success_url: `${opts.siteUrl}/cabinet?siege=ok`,
    cancel_url: `${opts.siteUrl}/cabinet?siege=annule`,
  };
  if (opts.patronEmail) params.customer_email = opts.patronEmail;
  for (const [k, v] of Object.entries(meta)) {
    params[`metadata[${k}]`] = v;
    params[`subscription_data[metadata][${k}]`] = v;
  }
  const r = await stripePost(opts.stripeKey, "checkout/sessions", params);
  if (!r.ok || !r.data?.url) throw new Error(r.data?.error?.message ?? "Erreur Stripe");
  return { url: r.data.url as string, id: r.data.id as string };
}
