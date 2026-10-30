// supabase/functions/_shared/onboarding-invite.ts
// Crée l'invitation d'onboarding (client_invites) et envoie l'e-mail
// "finalisez votre compte" pour un lead démo/vente qui vient d'être marqué
// converti — déclenché soit par le webhook Stripe (handle-conversion), soit
// par un commercial/admin marquant manuellement une conversion obtenue hors
// paiement en ligne (admin-convert-lead). Même contenu, même garde-fou
// d'idempotence dans les deux cas : jamais deux chemins de code qui
// dérivent l'un de l'autre pour le même évènement.

/** Même génération que randomToken() historique de handle-conversion : 24
 *  octets aléatoires cryptographiques, encodés en base36. */
export function randomInviteToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

async function sendBrevoEmail(
  brevoKey: string | undefined,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, email d'invitation non envoyé");
    return;
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
  if (!res.ok) {
    console.error("Brevo a refusé l'envoi:", res.status, await res.text());
  }
}

export interface CreateOnboardingInviteParams {
  supabaseUrl: string;
  supabaseKey: string;
  siteUrl: string;
  brevoKey?: string;
  demoRequestId: string;
  email: string;
  name: string | null;
}

export type CreateOnboardingInviteResult =
  | { status: "created" }
  | { status: "already_invited" }
  | { status: "error"; error: string };

/** Idempotent : si une invitation existe déjà pour ce lead, ne recrée rien
 *  et ne renvoie pas l'e-mail (sinon le client reçoit plusieurs liens
 *  d'onboarding avec des tokens différents). Ne touche JAMAIS au statut du
 *  lead (demo_requests.status) — c'est à l'appelant de le faire, pour
 *  rester explicite sur qui a déclenché la conversion. */
export async function createOnboardingInvite(
  params: CreateOnboardingInviteParams,
): Promise<CreateOnboardingInviteResult> {
  const { supabaseUrl, supabaseKey, siteUrl, brevoKey, demoRequestId, email, name } = params;
  const svcHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  const existingInviteRes = await fetch(
    `${supabaseUrl}/rest/v1/client_invites?demo_request_id=eq.${demoRequestId}&select=id&limit=1`,
    { headers: svcHeaders },
  );
  const existingInvites = await existingInviteRes.json();
  if (Array.isArray(existingInvites) && existingInvites.length > 0) {
    return { status: "already_invited" };
  }

  // Un seul produit (cotisation annuelle) : toujours "active".
  const plan = "active";
  const token = randomInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const inviteRes = await fetch(`${supabaseUrl}/rest/v1/client_invites`, {
    method: "POST",
    headers: { ...svcHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ demo_request_id: demoRequestId, email, plan, token, expires_at: expiresAt }),
  });
  if (!inviteRes.ok) {
    const detail = await inviteRes.text();
    console.error("createOnboardingInvite: échec insertion client_invites:", inviteRes.status, detail);
    return { status: "error", error: "Échec création de l'invitation." };
  }

  // Email best-effort : l'invitation est déjà créée à ce stade, une panne
  // Brevo ne doit pas faire échouer l'appelant.
  try {
    const onboardingUrl = `${siteUrl}/onboarding/${token}`;
    await sendBrevoEmail(
      brevoKey,
      email,
      "Bienvenue sur SwissBroker Pro — finalisez votre compte",
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f766e;">Merci pour votre confiance !</h2>
        <p>Bonjour ${name ?? ""},</p>
        <p>Votre cotisation annuelle SwissBroker Pro est confirmée. Il ne reste qu'une étape pour finaliser la création de votre compte :</p>
        <p style="margin: 24px 0;">
          <a href="${onboardingUrl}" style="background:#0f766e; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">Finaliser mon compte</a>
        </p>
        <p style="color:#666; font-size:13px;">Ce lien est valable 7 jours.</p>
        <p style="color:#999; font-size:12px;">SwissBroker Pro</p>
      </div>
      `,
    );
  } catch (emailErr) {
    console.error("createOnboardingInvite: erreur envoi email d'invitation (invitation déjà créée):", emailErr);
  }

  return { status: "created" };
}
