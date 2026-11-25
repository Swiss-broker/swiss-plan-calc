// supabase/functions/cabinet/index.ts
// Gestion des cabinets : un courtier crée son cabinet (il en devient le
// patron), invite ses collaborateurs, choisit pour chacun qui paie la
// cotisation, retire un collaborateur (ses clients restent au cabinet).
// L'argent des rendez-vous des collaborateurs arrive sur le compte du
// cabinet (voir stripe-rdv-invoice).
//
// verify_jwt=false : deux actions sont publiques (consulter une invitation,
// créer son compte depuis une invitation). Toutes les autres vérifient
// elles-mêmes la session auprès de Supabase Auth (/auth/v1/user).
import {
  rest,
  UUID_RE,
  EMAIL_RE,
  newToken,
  inviteExpiry,
  sendCabinetInvite,
  stopOwnRenewals,
  createSeatCheckout,
  stripePost,
  stripeDelete,
  type Svc,
} from "../_shared/cabinet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type Env = {
  supabaseUrl: string;
  supabaseKey: string;
  stripeKey: string;
  cotisationPriceId?: string;
  brevoKey?: string;
  siteUrl: string;
};

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string;
  cabinet_role: string | null;
  cabinet_root_id: string | null;
  cabinet_payer: "cabinet" | "self" | null;
  cabinet_seat_subscription_id: string | null;
};

type Invite = {
  id: string;
  cabinet_root_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  payer: "cabinet" | "self";
  status: "awaiting_payment" | "pending" | "accepted" | "revoked";
  token: string;
  stripe_subscription_item_id: string | null;
  expires_at: string;
};

const PROFILE_COLS =
  "id,email,first_name,last_name,plan,cabinet_role,cabinet_root_id,cabinet_payer,cabinet_seat_subscription_id";
const PROTECTED_PLANS = new Set(["internal", "demo"]);

class HttpError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

async function getProfile(svc: Svc, id: string): Promise<Profile | null> {
  const r = await rest<Profile[]>(svc, `profiles?id=eq.${id}&select=${PROFILE_COLS}`);
  return r.data?.[0] ?? null;
}

async function getProfileByEmail(svc: Svc, email: string): Promise<Profile | null> {
  // ilike pour ignorer la casse ; % et _ échappés pour une comparaison exacte.
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const r = await rest<Profile[]>(svc, `profiles?email=ilike.${encodeURIComponent(pattern)}&select=${PROFILE_COLS}`);
  return r.data?.[0] ?? null;
}

async function getCabinet(svc: Svc, rootId: string): Promise<{ root_id: string; name: string; address: string | null } | null> {
  const r = await rest<Array<{ root_id: string; name: string; address: string | null }>>(
    svc,
    `cabinets?root_id=eq.${rootId}&select=root_id,name,address`,
  );
  return r.data?.[0] ?? null;
}

async function getInviteByToken(svc: Svc, token: string): Promise<Invite | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await rest<Invite[]>(svc, `cabinet_invites?token=eq.${token}&select=*`);
  return r.data?.[0] ?? null;
}

async function getInvite(svc: Svc, id: string, rootId: string): Promise<Invite> {
  if (!UUID_RE.test(id)) throw new HttpError("INVITE_NOT_FOUND", 404);
  const r = await rest<Invite[]>(svc, `cabinet_invites?id=eq.${id}&cabinet_root_id=eq.${rootId}&select=*`);
  const inv = r.data?.[0];
  if (!inv) throw new HttpError("INVITE_NOT_FOUND", 404);
  return inv;
}

async function notify(svc: Svc, brokerId: string, type: string, title: string, body: string, link: string) {
  await rest(svc, "notifications", {
    method: "POST",
    prefer: "return=minimal",
    body: { broker_id: brokerId, type, title, body, link },
  });
}

async function logPlan(svc: Svc, brokerId: string, previous: string, next: string, reason: string) {
  if (previous === next) return;
  await rest(svc, "plan_events", {
    method: "POST",
    prefer: "return=minimal",
    body: { broker_id: brokerId, previous_plan: previous, new_plan: next, reason, stripe_event_id: null },
  });
}

async function authUser(req: Request, env: Env): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.supabaseKey, Authorization: auth },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u?.id || !u?.email) return null;
  return { id: u.id, email: String(u.email).toLowerCase() };
}

/** Patron : le courtier est root_director de son propre cabinet existant. */
async function requirePatron(svc: Svc, userId: string): Promise<{ me: Profile; cabinet: { name: string } }> {
  const me = await getProfile(svc, userId);
  if (!me || me.cabinet_role !== "root_director" || me.cabinet_root_id !== me.id) {
    throw new HttpError("NOT_PATRON", 403);
  }
  const cabinet = await getCabinet(svc, me.id);
  if (!cabinet) throw new HttpError("NOT_PATRON", 403);
  return { me, cabinet };
}

async function requireMember(svc: Svc, rootId: string, memberId: string): Promise<Profile> {
  if (!UUID_RE.test(memberId)) throw new HttpError("MEMBER_NOT_FOUND", 404);
  const m = await getProfile(svc, memberId);
  if (!m || m.cabinet_role !== "courtier" || m.cabinet_root_id !== rootId) {
    throw new HttpError("MEMBER_NOT_FOUND", 404);
  }
  return m;
}

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// ── Adhésion : cœur commun (compte existant ou compte tout juste créé) ──
async function acceptInvite(env: Env, svc: Svc, invite: Invite, userId: string, userEmail: string) {
  if (invite.status !== "pending" || new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new HttpError("INVITE_EXPIRED", 410);
  }
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) throw new HttpError("WRONG_ACCOUNT", 403);

  const me = await getProfile(svc, userId);
  if (!me) throw new HttpError("PROFILE_NOT_FOUND", 404);
  if (me.cabinet_root_id && me.cabinet_root_id !== invite.cabinet_root_id) throw new HttpError("ALREADY_IN_CABINET", 409);
  if (me.cabinet_role === "root_director") throw new HttpError("IS_PATRON", 409);
  const cabinet = await getCabinet(svc, invite.cabinet_root_id);
  if (!cabinet) throw new HttpError("INVITE_EXPIRED", 410);

  // Réclamation atomique : une seule adhésion par invitation.
  const claim = await rest<Invite[]>(
    svc,
    `cabinet_invites?id=eq.${invite.id}&status=eq.pending`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { status: "accepted", accepted_at: new Date().toISOString(), accepted_user_id: userId },
    },
  );
  if (!claim.data?.length) throw new HttpError("INVITE_EXPIRED", 410);

  const paidByCabinet = invite.payer === "cabinet";
  const nextPlan = paidByCabinet && !PROTECTED_PLANS.has(me.plan) ? "active" : me.plan;
  await rest(svc, `profiles?id=eq.${userId}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      cabinet_role: "courtier",
      cabinet_root_id: invite.cabinet_root_id,
      manager_id: invite.cabinet_root_id,
      cabinet_payer: invite.payer,
      cabinet_seat_subscription_id: paidByCabinet ? invite.stripe_subscription_item_id : null,
      cabinet_joined_at: new Date().toISOString(),
      brokerage_name: cabinet.name,
      plan: nextPlan,
    },
  });
  await logPlan(svc, userId, me.plan, nextPlan, "cabinet_joined");
  if (paidByCabinet) await stopOwnRenewals(env.stripeKey, userEmail);

  const name = `${me.first_name ?? invite.first_name ?? ""} ${me.last_name ?? invite.last_name ?? ""}`.trim() || userEmail;
  await notify(svc, invite.cabinet_root_id, "team_member_joined", "Nouveau collaborateur", `${name} a rejoint votre cabinet.`, "/cabinet");
}

/**
 * Départ d'un collaborateur (retiré par le patron ou parti de lui-même) :
 * ses clients et tous leurs dossiers restent au cabinet (transférés au
 * patron), son siège payé par le cabinet s'arrête, et il n'encaisse plus
 * sur le compte du cabinet (plus de cabinet_root_id).
 */
async function detachMember(env: Env, svc: Svc, member: Profile, rootId: string) {
  const transfer = await fetch(`${env.supabaseUrl}/rest/v1/rpc/cabinet_transfer_member_data`, {
    method: "POST",
    headers: { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ _member: member.id, _root: rootId }),
  });
  if (!transfer.ok) {
    console.error("Transfert impossible", transfer.status, await transfer.text());
    throw new HttpError("TRANSFER_FAILED", 500);
  }
  if (member.cabinet_seat_subscription_id && env.stripeKey) {
    await stripeDelete(env.stripeKey, `subscriptions/${member.cabinet_seat_subscription_id}`);
  }
  const nextPlan =
    member.cabinet_payer === "cabinet" && !PROTECTED_PLANS.has(member.plan) ? "expired" : member.plan;
  await rest(svc, `profiles?id=eq.${member.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      cabinet_role: null,
      cabinet_root_id: null,
      manager_id: null,
      cabinet_payer: null,
      cabinet_seat_subscription_id: null,
      cabinet_joined_at: null,
      plan: nextPlan,
    },
  });
  await logPlan(svc, member.id, member.plan, nextPlan, "cabinet_removed");
}

export async function handleCabinetRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!env.supabaseUrl || !env.supabaseKey) return json({ error: "CONFIG_MISSING" }, 500);
  const svc: Svc = { supabaseUrl: env.supabaseUrl, supabaseKey: env.supabaseKey };

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 40);

    // ── Public : afficher une invitation ──
    if (action === "info") {
      const invite = await getInviteByToken(svc, str(body?.token, 100));
      if (!invite || invite.status === "revoked" || invite.status === "awaiting_payment") {
        return json({ error: "INVITE_NOT_FOUND" }, 404);
      }
      if (invite.status === "accepted") return json({ error: "INVITE_USED" }, 410);
      if (new Date(invite.expires_at).getTime() <= Date.now()) return json({ error: "INVITE_EXPIRED" }, 410);
      const cabinet = await getCabinet(svc, invite.cabinet_root_id);
      const existing = await getProfileByEmail(svc, invite.email);
      return json({
        cabinetName: cabinet?.name ?? "",
        email: invite.email,
        firstName: invite.first_name ?? "",
        lastName: invite.last_name ?? "",
        payer: invite.payer,
        accountExists: !!existing,
      });
    }

    // ── Public : créer son compte depuis l'invitation, puis adhérer ──
    if (action === "signup_accept") {
      const invite = await getInviteByToken(svc, str(body?.token, 100));
      if (!invite || invite.status !== "pending" || new Date(invite.expires_at).getTime() <= Date.now()) {
        return json({ error: "INVITE_EXPIRED" }, 410);
      }
      const password = typeof body?.password === "string" ? body.password : "";
      const firstName = str(body?.first_name, 80) || invite.first_name || "";
      const lastName = str(body?.last_name, 80) || invite.last_name || "";
      if (password.length < 8) return json({ error: "PASSWORD_TOO_SHORT" }, 400);
      if (!firstName || !lastName) return json({ error: "NAME_REQUIRED" }, 400);
      if (await getProfileByEmail(svc, invite.email)) return json({ error: "ACCOUNT_EXISTS" }, 409);

      // L'adresse est confirmée par le lien reçu dans cette même boîte mail.
      const created = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          password,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName },
        }),
      });
      const user = await created.json().catch(() => null);
      if (!created.ok || !user?.id) {
        console.error("Création du compte impossible", created.status, JSON.stringify(user));
        return json({ error: created.status === 422 ? "ACCOUNT_EXISTS" : "SIGNUP_FAILED" }, created.status === 422 ? 409 : 500);
      }
      await acceptInvite(env, svc, invite, user.id, invite.email);
      return json({ ok: true, email: invite.email });
    }

    // ── Toutes les autres actions : courtier connecté ──
    const caller = await authUser(req, env);
    if (!caller) return json({ error: "AUTH_REQUIRED" }, 401);

    if (action === "accept") {
      const invite = await getInviteByToken(svc, str(body?.token, 100));
      if (!invite) return json({ error: "INVITE_NOT_FOUND" }, 404);
      await acceptInvite(env, svc, invite, caller.id, caller.email);
      return json({ ok: true });
    }

    if (action === "create") {
      const name = str(body?.name, 120);
      const address = str(body?.address, 300) || null;
      if (name.length < 2) return json({ error: "NAME_REQUIRED" }, 400);
      const me = await getProfile(svc, caller.id);
      if (!me) return json({ error: "PROFILE_NOT_FOUND" }, 404);
      if (me.cabinet_role === "courtier") return json({ error: "ALREADY_IN_CABINET" }, 409);
      const existing = await getCabinet(svc, me.id);
      if (existing) {
        await rest(svc, `cabinets?root_id=eq.${me.id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: { name, address, updated_at: new Date().toISOString() },
        });
      } else {
        const ins = await rest(svc, "cabinets", { method: "POST", prefer: "return=minimal", body: { root_id: me.id, name, address } });
        if (!ins.ok) return json({ error: "CREATE_FAILED" }, 500);
      }
      await rest(svc, `profiles?id=eq.${me.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { cabinet_role: "root_director", cabinet_root_id: me.id, manager_id: null, brokerage_name: name },
      });
      // Collaborateurs déjà présents : nom du cabinet tenu à jour sur leurs PDF.
      await rest(svc, `profiles?cabinet_root_id=eq.${me.id}&cabinet_role=eq.courtier`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { brokerage_name: name },
      });
      return json({ ok: true });
    }

    // ── Un collaborateur quitte le cabinet de lui-même ──
    if (action === "leave") {
      const self = await getProfile(svc, caller.id);
      if (!self || self.cabinet_role !== "courtier" || !self.cabinet_root_id) {
        return json({ error: "NOT_MEMBER" }, 409);
      }
      const rootId = self.cabinet_root_id;
      await detachMember(env, svc, self, rootId);
      const name = `${self.first_name ?? ""} ${self.last_name ?? ""}`.trim() || self.email || "Un collaborateur";
      await notify(
        svc,
        rootId,
        "cabinet_removed",
        "Un collaborateur a quitté le cabinet",
        `${name} a quitté votre cabinet. Ses clients et leurs dossiers sont désormais dans votre liste.`,
        "/cabinet",
      );
      return json({ ok: true });
    }

    // ── Actions du patron ──
    const { me, cabinet } = await requirePatron(svc, caller.id);

    if (action === "invite") {
      const email = str(body?.email, 200).toLowerCase();
      const firstName = str(body?.first_name, 80);
      const lastName = str(body?.last_name, 80);
      const payer = body?.payer === "cabinet" ? "cabinet" : body?.payer === "self" ? "self" : null;
      if (!EMAIL_RE.test(email)) return json({ error: "EMAIL_INVALID" }, 400);
      if (!firstName || !lastName) return json({ error: "NAME_REQUIRED" }, 400);
      if (!payer) return json({ error: "PAYER_REQUIRED" }, 400);
      if (email === (me.email ?? "").toLowerCase()) return json({ error: "SELF_INVITE" }, 400);
      const existing = await getProfileByEmail(svc, email);
      if (existing?.cabinet_root_id) {
        return json({ error: existing.cabinet_root_id === me.id ? "ALREADY_MEMBER" : "ALREADY_IN_CABINET" }, 409);
      }
      const open = await rest<Invite[]>(
        svc,
        `cabinet_invites?cabinet_root_id=eq.${me.id}&email=eq.${encodeURIComponent(email)}&status=in.(pending,awaiting_payment)&select=id`,
      );
      if (open.data?.length) return json({ error: "INVITE_EXISTS" }, 409);

      const token = newToken();
      const ins = await rest<Invite[]>(svc, "cabinet_invites", {
        method: "POST",
        prefer: "return=representation",
        body: {
          cabinet_root_id: me.id,
          invited_by: me.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role: "courtier",
          payer,
          status: payer === "cabinet" ? "awaiting_payment" : "pending",
          token,
          expires_at: inviteExpiry(),
        },
      });
      const invite = ins.data?.[0];
      if (!invite) return json({ error: "INVITE_FAILED" }, 500);

      if (payer === "self") {
        const sent = await sendCabinetInvite(svc, env.brevoKey, env.siteUrl, invite);
        return json({ ok: true, status: "pending", emailSent: sent });
      }
      // Cotisation payée par le cabinet : le patron règle d'abord le siège,
      // l'invitation part automatiquement une fois le paiement confirmé.
      if (!env.stripeKey || !env.cotisationPriceId) return json({ error: "CONFIG_MISSING" }, 500);
      const session = await createSeatCheckout({
        stripeKey: env.stripeKey,
        priceId: env.cotisationPriceId,
        siteUrl: env.siteUrl,
        patronEmail: me.email,
        rootId: me.id,
        inviteId: invite.id,
      });
      await rest(svc, `cabinet_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { stripe_checkout_session_id: session.id },
      });
      return json({ ok: true, status: "awaiting_payment", checkoutUrl: session.url });
    }

    if (action === "pay_seat") {
      const invite = await getInvite(svc, str(body?.inviteId, 40), me.id);
      if (invite.status !== "awaiting_payment") return json({ error: "INVITE_NOT_AWAITING_PAYMENT" }, 409);
      if (!env.stripeKey || !env.cotisationPriceId) return json({ error: "CONFIG_MISSING" }, 500);
      const session = await createSeatCheckout({
        stripeKey: env.stripeKey,
        priceId: env.cotisationPriceId,
        siteUrl: env.siteUrl,
        patronEmail: me.email,
        rootId: me.id,
        inviteId: invite.id,
      });
      await rest(svc, `cabinet_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { stripe_checkout_session_id: session.id },
      });
      return json({ ok: true, checkoutUrl: session.url });
    }

    if (action === "resend") {
      const invite = await getInvite(svc, str(body?.inviteId, 40), me.id);
      if (invite.status !== "pending") return json({ error: "INVITE_NOT_PENDING" }, 409);
      const token = newToken();
      await rest(svc, `cabinet_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { token, expires_at: inviteExpiry() },
      });
      const sent = await sendCabinetInvite(svc, env.brevoKey, env.siteUrl, { ...invite, token });
      return json({ ok: true, emailSent: sent });
    }

    if (action === "revoke") {
      const invite = await getInvite(svc, str(body?.inviteId, 40), me.id);
      if (invite.status === "accepted" || invite.status === "revoked") return json({ error: "INVITE_NOT_PENDING" }, 409);
      await rest(svc, `cabinet_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "revoked" },
      });
      // Siège déjà payé pour une invitation jamais utilisée : plus de renouvellement.
      if (invite.stripe_subscription_item_id && env.stripeKey) {
        await stripeDelete(env.stripeKey, `subscriptions/${invite.stripe_subscription_item_id}`);
      }
      return json({ ok: true });
    }

    if (action === "set_payer") {
      const member = await requireMember(svc, me.id, str(body?.memberId, 40));
      const payer = body?.payer === "cabinet" ? "cabinet" : body?.payer === "self" ? "self" : null;
      if (!payer) return json({ error: "PAYER_REQUIRED" }, 400);
      if (payer === member.cabinet_payer) return json({ ok: true, unchanged: true });

      if (payer === "self") {
        // Le siège reste valable jusqu'à son échéance, puis n'est pas
        // renouvelé : le collaborateur règle alors lui-même sa cotisation.
        if (member.cabinet_seat_subscription_id && env.stripeKey) {
          const r = await stripePost(env.stripeKey, `subscriptions/${member.cabinet_seat_subscription_id}`, {
            cancel_at_period_end: "true",
          });
          if (!r.ok) return json({ error: "STRIPE_ERROR" }, 502);
          await notify(
            svc,
            member.id,
            "cabinet_payer_changed",
            "Votre cotisation",
            `À la prochaine échéance, ${cabinet.name} ne prendra plus en charge votre cotisation annuelle. Vous pourrez la régler depuis votre compte.`,
            "/account?tab=abonnement",
          );
          return json({ ok: true, effective: "renewal" });
        }
        await rest(svc, `profiles?id=eq.${member.id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: { cabinet_payer: "self", cabinet_seat_subscription_id: null },
        });
        return json({ ok: true, effective: "now" });
      }

      // payer === "cabinet" : le patron règle un siège pour ce collaborateur.
      if (!env.stripeKey || !env.cotisationPriceId) return json({ error: "CONFIG_MISSING" }, 500);
      const session = await createSeatCheckout({
        stripeKey: env.stripeKey,
        priceId: env.cotisationPriceId,
        siteUrl: env.siteUrl,
        patronEmail: me.email,
        rootId: me.id,
        memberId: member.id,
      });
      return json({ ok: true, checkoutUrl: session.url });
    }

    if (action === "remove") {
      const member = await requireMember(svc, me.id, str(body?.memberId, 40));
      await detachMember(env, svc, member, me.id);
      await notify(
        svc,
        member.id,
        "cabinet_removed",
        "Vous ne faites plus partie du cabinet",
        `${cabinet.name} vous a retiré de son équipe. Les dossiers clients restent au cabinet.`,
        "/account?tab=abonnement",
      );
      return json({ ok: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code }, err.status);
    console.error("cabinet", err);
    return json({ error: "SERVER_ERROR" }, 500);
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
    handleCabinetRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
      cotisationPriceId: Deno.env.get("STRIPE_COTISATION_ANNUELLE"),
      brevoKey: Deno.env.get("BREVO_API_KEY"),
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
