// supabase/functions/cabinet-add-seat/index.ts
// Envoie une invitation cabinet. Deux cas selon "payer" :
// - "cabinet" : débite immédiatement le siège sur l'abonnement du
//   directeur qui invite (ou crée un abonnement à la volée si besoin),
//   puis envoie l'email.
// - "self" : aucun débit ici. L'email envoyé mène vers une inscription
//   classique ; c'est la personne invitée qui paiera elle-même, à ce
//   moment le rattachement au cabinet se fera (voir stripe-webhook).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEAT_PRICE_ID = "price_1U17fiRzqfEoHxSu8CIqtbtA";

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true dans config.toml —
 *  avant même l'exécution de cette fonction). Ne JAMAIS faire confiance à
 *  un id envoyé dans le corps de la requête pour l'identité de l'appelant :
 *  n'importe qui pourrait sinon usurper n'importe quel autre compte. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Non authentifié.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Jeton invalide.");
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const payload = JSON.parse(atob(b64));
  if (!payload.sub) throw new Error("Jeton invalide.");
  return payload.sub as string;
}

async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) throw new Error("BREVO_API_KEY manquante");
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
  const resBody = await res.text();
  if (!res.ok) throw new Error(`Brevo a refusé l'envoi (${res.status}): ${resBody}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const inviterId = getVerifiedUserId(req);
    const {
      cabinetRootId,
      inviteeEmail,
      inviteeFirstName,
      inviteeLastName,
      role,
      payer,
    } = await req.json();

    if (!cabinetRootId || !inviteeEmail) {
      throw new Error("Paramètres manquants.");
    }
    if (role !== "director" && role !== "courtier") {
      throw new Error("Rôle invalide.");
    }
    if (payer !== "cabinet" && payer !== "self") {
      throw new Error("Choix du payeur invalide.");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://swiss-plan-calc.vercel.app";
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Comptes internes (fondatrice, associé) : accès illimité, aucune
    // facturation ne doit jamais se déclencher quand ils invitent
    // quelqu'un, même s'ils choisissent "cabinet paie".
    const inviterProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${inviterId}&select=email,plan,cabinet_role,cabinet_root_id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const inviterProfiles = await inviterProfileRes.json();
    const inviter = inviterProfiles[0];
    if (!inviter) throw new Error("Profil introuvable.");
    const isInternal = inviter.plan === "internal";
    const inviterEmail = inviter.email;

    // Autorité sur le cabinet ciblé : le directeur racine ne peut agir que
    // pour son propre cabinet (cabinetRootId === son propre id), un
    // directeur normal seulement pour le cabinet auquel il appartient
    // (cabinetRootId === son cabinet_root_id). Sans ce contrôle, n'importe
    // quel compte authentifié pourrait injecter une invitation — et
    // déclencher une facturation Stripe réelle — dans le cabinet de
    // quelqu'un d'autre en devinant/connaissant son cabinetRootId.
    const inviterHasAuthority =
      isInternal ||
      (inviter.cabinet_role === "root_director" && cabinetRootId === inviterId) ||
      (inviter.cabinet_role === "director" && cabinetRootId === inviter.cabinet_root_id);
    if (!inviterHasAuthority) {
      throw new Error("Vous n'avez pas l'autorité pour inviter dans ce cabinet.");
    }

    let seatItemId: string | null = null;

    // ── Cas "le cabinet paie" (et que ce n'est pas un compte interne) ──
    if (payer === "cabinet" && !isInternal) {
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(inviterEmail)}&limit=1`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } },
      );
      const customerData = await customerRes.json();
      let customer = customerData.data?.[0];
      if (!customer) {
        const createCustomerRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ email: inviterEmail }).toString(),
        });
        customer = await createCustomerRes.json();
        if (!createCustomerRes.ok) throw new Error(customer.error?.message ?? "Erreur création client Stripe.");
      }

      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=1`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } },
      );
      const subData = await subRes.json();
      const subscription = subData.data?.[0];

      if (subscription) {
        const itemRes = await fetch("https://api.stripe.com/v1/subscription_items", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            subscription: subscription.id,
            price: SEAT_PRICE_ID,
            quantity: "1",
            proration_behavior: "always_invoice",
          }).toString(),
        });
        const item = await itemRes.json();
        if (!itemRes.ok) throw new Error(item.error?.message ?? "Erreur lors de l'ajout du siège.");
        seatItemId = item.id;
      } else {
        const createSubRes = await fetch("https://api.stripe.com/v1/subscriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            customer: customer.id,
            "items[0][price]": SEAT_PRICE_ID,
            "items[0][quantity]": "1",
          }).toString(),
        });
        const newSub = await createSubRes.json();
        if (!createSubRes.ok) throw new Error(newSub.error?.message ?? "Erreur création abonnement.");
        seatItemId = newSub.items?.data?.[0]?.id ?? newSub.id;
      }
    }

    // Si la personne a déjà un compte (ex. Starter/Pro existant) et que
    // le cabinet paie, on la rattache immédiatement, sans passer par une
    // création de compte : elle n'a qu'à se reconnecter avec son mot de
    // passe habituel. Son ancien plan est remplacé par l'accès cabinet.
    const existingProfileRes = await fetch(
     `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(inviteeEmail)}&select=id,cabinet_role,plan`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const existingProfiles = await existingProfileRes.json();
    const existingProfile = existingProfiles[0];
    // Si la personne a déjà un abonnement individuel actif (Starter/Pro),
    // on bloque : elle doit d'abord annuler elle-même cet abonnement
    // depuis son profil (il restera actif jusqu'à sa date d'échéance,
    // aucun remboursement ni coupure immédiate), puis le directeur pourra
    // relancer l'invitation une fois cette date passée. Rien n'est modifié
    // automatiquement sur son abonnement, elle garde le contrôle.
    if (existingProfile && (existingProfile.plan === "starter" || existingProfile.plan === "pro")) {
      throw new Error(
        "Cette personne a déjà un abonnement individuel actif. Demandez-lui d'annuler son abonnement depuis son profil (il restera actif jusqu'à sa date d'échéance), puis relancez l'invitation après cette date.",
      );
    }

    if (existingProfile && payer === "cabinet") {
      if (existingProfile.cabinet_role) {
        throw new Error("Cette personne fait déjà partie d'un cabinet.");
      }

      const managerId = role === "director" ? cabinetRootId : inviterId;
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${existingProfile.id}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          plan: "cabinet",
          manager_id: managerId,
          cabinet_root_id: cabinetRootId,
          cabinet_role: role,
        }),
      });

      const roleLabelExisting = role === "director" ? "Directeur" : "Courtier";
      const greetingExisting = inviteeFirstName ? `Bonjour ${inviteeFirstName},` : "Bonjour,";
      await sendBrevoEmail(
        inviteeEmail,
        "Vous avez rejoint un cabinet sur SwissBroker Pro",
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f766e;">Votre compte a été mis à jour</h2>
          <p>${greetingExisting}</p>
          <p>Vous avez été ajouté(e) à un cabinet sur SwissBroker Pro, avec un accès en tant que <strong>${roleLabelExisting}</strong>. Votre compte existant a été mis à niveau, vous n'avez rien à faire de plus.</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="${siteUrl}/auth" style="background:#0f766e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
              Me connecter
            </a>
          </p>
        </div>
        `,
      );

      return new Response(JSON.stringify({ sent: true, attachedExisting: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Créer l'invitation en base, avec un token unique.
    const token = crypto.randomUUID();
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/cabinet_invites`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        invited_by: inviterId,
        cabinet_root_id: cabinetRootId,
        email: inviteeEmail,
        first_name: inviteeFirstName ?? null,
        last_name: inviteeLastName ?? null,
        role,
        payer,
        token,
        stripe_subscription_item_id: seatItemId,
      }),
    });
    const insertBody = await insertRes.json();
    if (!insertRes.ok) {
      console.error("Erreur insertion cabinet_invites:", insertRes.status, JSON.stringify(insertBody));
      throw new Error("L'invitation n'a pas pu être enregistrée.");
    }

    // Envoyer l'email, avec un texte adapté selon qui doit payer.
    const roleLabel = role === "director" ? "Directeur" : "Courtier";
    const signupUrl = `${siteUrl}/auth?invite=${token}`;
    const greeting = inviteeFirstName ? `Bonjour ${inviteeFirstName},` : "Bonjour,";
    const paymentNote =
      payer === "cabinet"
        ? "<p>Votre accès est déjà réglé par le cabinet, il ne vous reste qu'à créer votre compte pour commencer.</p>"
        : "<p>Pour finaliser votre accès (290 CHF/mois), vous serez invité(e) à créer votre compte puis à régler votre abonnement.</p>";
    await sendBrevoEmail(
      inviteeEmail,
      "Vous êtes invité(e) à rejoindre un cabinet sur SwissBroker Pro",
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f766e;">Invitation SwissBroker Pro</h2>
        <p>${greeting}</p>
        <p>Vous avez été invité(e) à rejoindre un cabinet sur SwissBroker Pro, avec un accès en tant que <strong>${roleLabel}</strong>.</p>
        ${paymentNote}
        <p style="text-align:center; margin: 24px 0;">
          <a href="${signupUrl}" style="background:#0f766e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Créer mon compte
          </a>
        </p>
        <p style="color:#666; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : <br />${signupUrl}</p>
        <p style="color:#999; font-size:12px; margin-top:24px;">Ce lien expire dans 14 jours.</p>
      </div>
      `,
    );

    return new Response(JSON.stringify({ sent: true, inviteId: insertBody[0]?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});