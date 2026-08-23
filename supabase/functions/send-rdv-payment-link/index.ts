// supabase/functions/send-rdv-payment-link/index.ts
// Envoie par email au client le lien de paiement de sa consultation RDV,
// via Brevo (même méthode que la notification broker dans stripe-webhook).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (!brevoKey) {
    throw new Error("BREVO_API_KEY manquante, email non envoyé");
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SwissBroker Pro", email: "noreply@swissbrokerpro.ch" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const resBody = await res.text();
  if (!res.ok) {
    throw new Error(`Brevo a refusé l'envoi (${res.status}): ${resBody}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const callerId = getVerifiedUserId(req);
    const { clientEmail, clientName, brokerName, amountChf, paymentLink } = await req.json();

    if (!clientEmail) throw new Error("Email du client manquant.");
    if (!paymentLink) throw new Error("Lien de paiement manquant.");
    if (!amountChf) throw new Error("Montant manquant.");

    // Cette fonction envoie un email depuis le domaine de confiance de
    // l'app à une adresse arbitraire : sans vérifier que le lien de
    // paiement correspond bien à une facture réelle appartenant à
    // l'appelant, n'importe quel compte authentifié pourrait s'en servir
    // comme relais pour envoyer un contenu de phishing à qui il veut.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");
    const invoiceRes = await fetch(
      `${supabaseUrl}/rest/v1/rdv_invoices?broker_id=eq.${callerId}&stripe_payment_link=eq.${encodeURIComponent(paymentLink)}&select=id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const invoices = await invoiceRes.json();
    if (!Array.isArray(invoices) || invoices.length === 0) {
      throw new Error("Ce lien de paiement ne correspond à aucune facture vous appartenant.");
    }

    const displayAmount = Number(amountChf).toLocaleString("fr-CH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const senderLabel = brokerName ? `${brokerName}` : "Votre courtier SwissBroker Pro";

    await sendBrevoEmail(
      clientEmail,
      `Votre lien de paiement — ${displayAmount} CHF`,
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f766e;">Consultation en prévoyance</h2>
        <p>Bonjour ${clientName ?? ""},</p>
        <p>${senderLabel} vous a envoyé un lien de paiement sécurisé pour votre consultation.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr style="background:#f0fdf4;">
            <td style="padding:8px 12px; font-weight:bold;">Montant à régler</td>
            <td style="padding:8px 12px;">${displayAmount} CHF</td>
          </tr>
        </table>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${paymentLink}" style="background:#0f766e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Payer maintenant
          </a>
        </p>
        <p style="color:#666; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : <br />${paymentLink}</p>
        <p style="color:#999; font-size:12px; margin-top:24px;">SwissBroker Pro — Piliarys</p>
      </div>
      `
    );

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});