const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true — avant même
 *  l'exécution de cette fonction). Ne jamais faire confiance à un id
 *  envoyé dans le corps de la requête. */
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

async function sendBrevoEmail(brevoKey: string | undefined, to: string, subject: string, htmlContent: string) {
  if (!brevoKey) throw new Error("BREVO_API_KEY manquante, email non envoyé");
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

export type Env = { supabaseUrl: string; supabaseKey: string; brevoKey?: string };

export async function handleAdminInviteCommercialRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email: rawEmail, displayName } = await req.json();
    const email = String(rawEmail ?? "").trim().toLowerCase();
    const name = String(displayName ?? "").trim();

    if (!email || !name) throw new Error("Email et nom requis.");
    // Règle systématique du mode démo : un compte @swissbrokerpro.ch n'est
    // jamais un compte de production — c'est ce qui permet de le
    // court-circuiter sans risque vers plan='demo'. Vérifié ici, côté
    // serveur, pour qu'un admin ne puisse pas faire glisser par erreur une
    // adresse personnelle de courtier réel dans ce chemin.
    if (!email.endsWith("@swissbrokerpro.ch")) {
      throw new Error("Seules les adresses @swissbrokerpro.ch peuvent être invitées comme commercial.");
    }

    const callerId = getVerifiedUserId(req);
    const { supabaseUrl, supabaseKey, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // Réservé aux administrateurs stricts (role='admin'), pas juste
    // "staff" : un commercial ne doit pas pouvoir en inviter un autre.
    const callerRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&role=eq.admin&select=user_id`,
      { headers: svcHeaders },
    );
    const callerRows = await callerRes.json();
    if (!Array.isArray(callerRows) || callerRows.length === 0) {
      throw new Error("Réservé aux administrateurs.");
    }

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(" ");

    // Un compte existe-t-il déjà pour cet email ? profiles.id = auth.users.id,
    // et handle_new_user garantit qu'une ligne profiles existe pour tout
    // compte réellement créé — chercher par email dans profiles est donc
    // une façon fiable de détecter un compte existant, sans dépendre du
    // format exact de filtrage de l'API Admin Auth.
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,plan`,
      { headers: svcHeaders },
    );
    const existingRows = await existingRes.json();
    const existingProfile = Array.isArray(existingRows) ? existingRows[0] : undefined;

    if (existingProfile) {
      // Rattachement silencieux d'un compte déjà existant : pas de nouvel
      // email, juste mise à jour des accès. Jamais sur un compte déjà
      // 'internal' (Karlyta/James) — ce chemin ne doit jamais pouvoir
      // toucher un accès fondateur.
      if (existingProfile.plan === "internal") {
        throw new Error("Ce compte est en accès interne — non modifiable via cette action.");
      }

      const existingAdminRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${existingProfile.id}&select=user_id,role`,
        { headers: svcHeaders },
      );
      const existingAdminRows = await existingAdminRes.json();
      const existingAdmin = Array.isArray(existingAdminRows) ? existingAdminRows[0] : undefined;

      // Jamais rétrograder un admin existant en commercial par erreur de
      // saisie d'email : ce bouton n'accorde jamais que l'accès commercial,
      // jamais n'en retire un supérieur.
      if (existingAdmin && existingAdmin.role === "admin") {
        throw new Error("Ce compte est déjà administrateur — non modifiable via cette action.");
      }

      if (existingAdmin) {
        await fetch(`${supabaseUrl}/rest/v1/admin_users?user_id=eq.${existingProfile.id}`, {
          method: "PATCH",
          headers: { ...svcHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ display_name: name, role: "commercial", email }),
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/admin_users`, {
          method: "POST",
          headers: { ...svcHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: existingProfile.id, email, display_name: name, role: "commercial" }),
        });
      }

      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${existingProfile.id}`, {
        method: "PATCH",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ plan: "demo" }),
      });

      return new Response(JSON.stringify({ ok: true, mode: "reattached", userId: existingProfile.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nouveau compte : generate_link (type=invite) crée l'utilisateur SANS
    // envoyer l'email natif Supabase — on envoie notre propre email Brevo,
    // cohérent avec le reste du projet, et seul moyen d'y inclure les deux
    // liens team + app courtier.
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({
        type: "invite",
        email,
        data: { first_name: firstName, last_name: lastName },
      }),
    });
    const linkBody = await linkRes.json();
    if (!linkRes.ok) {
      throw new Error(linkBody?.msg || linkBody?.error_description || "Échec de la création du compte.");
    }
    const newUserId = linkBody?.user?.id;
    const actionLink = linkBody?.properties?.action_link;
    if (!newUserId || !actionLink) {
      throw new Error("Réponse inattendue de l'API d'invitation.");
    }

    await fetch(`${supabaseUrl}/rest/v1/admin_users`, {
      method: "POST",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: newUserId, email, display_name: name, role: "commercial" }),
    });

    // handle_new_user (trigger) vient d'insérer profiles avec plan='trial'
    // par défaut (aucun invite_token cabinet ici) : correction explicite
    // vers 'demo' juste après.
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${newUserId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ plan: "demo" }),
    });

    await sendBrevoEmail(
      brevoKey,
      email,
      "Votre accès SwissBroker Pro (mode démo)",
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f766e;">Bienvenue chez SwissBroker Pro</h2>
        <p>Bonjour ${firstName || name},</p>
        <p>Un accès commercial vient de vous être créé. Cliquez ci-dessous pour définir votre mot de passe :</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${actionLink}" style="background:#0f766e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Définir mon mot de passe
          </a>
        </p>
        <p>Une fois votre mot de passe défini, connectez-vous avec cette même adresse email et ce mot de passe sur :</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr style="background:#f0fdf4;">
            <td style="padding:8px 12px; font-weight:bold;">Panel team</td>
            <td style="padding:8px 12px;"><a href="https://team.swissbrokerpro.ch">team.swissbrokerpro.ch</a></td>
          </tr>
          <tr>
            <td style="padding:8px 12px; font-weight:bold;">Application courtier (mode démo)</td>
            <td style="padding:8px 12px;"><a href="https://swissbrokerpro.ch">swissbrokerpro.ch</a></td>
          </tr>
        </table>
        <p style="color:#666; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : <br />${actionLink}</p>
        <p style="color:#999; font-size:12px; margin-top:24px;">SwissBroker Pro — Piliarys</p>
      </div>
      `,
    );

    return new Response(JSON.stringify({ ok: true, mode: "invited", userId: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleAdminInviteCommercialRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
