// supabase/functions/send-rdv-payment-link/index.ts
// Envoie par email au client le lien de paiement de sa consultation RDV,
// via Brevo (même méthode que la notification broker dans stripe-webhook).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { clientEmail, clientName, brokerName, amountChf, paymentLink } = await req.json();

    if (!clientEmail) throw new Error("Email du client manquant.");
    if (!paymentLink) throw new Error("Lien de paiement manquant.");
    if (!amountChf) throw new Error("Montant manquant.");

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