const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Variables d'environnement manquantes");
    }

    const body = await req.text();
    const event = JSON.parse(body);

    const updatePlan = async (email: string, plan: string) => {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ plan }),
        }
      );
      return res.ok;
    };

    // ── Abonnement SwissBroker Pro ──
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details?.email ?? session.customer_email;
      const plan = session.metadata?.plan ?? "pro";
      if (email) await updatePlan(email, plan);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${subscription.customer}`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const customer = await customerRes.json();
      if (customer.email) await updatePlan(customer.email, "expired");
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${invoice.customer}`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const customer = await customerRes.json();
      if (customer.email) await updatePlan(customer.email, "expired");
    }

    // ── Paiement RDV courtier ──
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const brokerId = pi.metadata?.broker_id;
      const clientId = pi.metadata?.client_id;
      const amountChf = pi.amount / 100;
      const commission = Math.round(pi.amount * 0.10) / 100;
      const brokerReceives = amountChf - commission;

      if (brokerId) {
        // Marquer la facture comme payée et PDF débloqué
        await fetch(
          `${supabaseUrl}/rest/v1/rdv_invoices?stripe_payment_intent_id=eq.${pi.id}`,
          {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ status: "paid", pdf_unlocked: true }),
          }
        );

        // Récupérer l'email du courtier
        const brokerRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}&select=email,first_name,last_name`,
          { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
        );
        const brokers = await brokerRes.json();
        const broker = brokers[0];

        if (broker?.email) {
          // Email de notification au courtier
          await sendBrevoEmail(
            broker.email,
            `Paiement reçu — ${amountChf.toFixed(2)} CHF`,
            `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0f766e;">Paiement reçu 💶</h2>
              <p>Bonjour ${broker.first_name ?? ""},</p>
              <p>Un client vient de régler sa consultation. Voici le détail :</p>
              <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold;">Montant total</td>
                  <td style="padding:8px 12px;">${amountChf.toFixed(2)} CHF</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;">Commission SwissBroker Pro (10%)</td>
                  <td style="padding:8px 12px;">- ${commission.toFixed(2)} CHF</td>
                </tr>
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold;">Vous recevrez</td>
                  <td style="padding:8px 12px; font-weight:bold; color:#0f766e;">${brokerReceives.toFixed(2)} CHF</td>
                </tr>
              </table>
              <p>Le PDF de synthèse du rendez-vous est désormais débloqué dans la fiche de votre client.</p>
              <p style="color:#999; font-size:12px;">SwissBroker Pro — Piliarys</p>
            </div>
            `
          );
        }

        // Marquer le compte Connect comme onboarding complet
        await fetch(
          `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}`,
          {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ onboarding_complete: true }),
          }
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
