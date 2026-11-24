import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCabinetRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "service-key",
  stripeKey: "sk_test_fake",
  cotisationPriceId: "price_cotisation",
  brevoKey: "brevo_fake",
  siteUrl: "https://swissbrokerpro.ch",
};

type Row = Record<string, unknown>;
let profiles: Row[];
let cabinets: Row[];
let invites: Row[];
let calls: Array<{ method: string; url: string; body: unknown }>;
let emails: Array<{ to: unknown; subject: string; html: string }>;
let sessions: Record<string, string>; // token -> user id

const M1 = "44444444-4444-4444-8444-444444444444";
const TOKEN = "a".repeat(64);
const future = () => new Date(Date.now() + 86400000).toISOString();

function baseState() {
  profiles = [
    { id: "root-1", email: "james@piliarys.ch", first_name: "James", last_name: "P", plan: "internal", cabinet_role: "root_director", cabinet_root_id: "root-1", cabinet_payer: null, cabinet_seat_subscription_id: null },
    { id: "indep-1", email: "lea@x.ch", first_name: "Léa", last_name: "Martin", plan: "active", cabinet_role: null, cabinet_root_id: null, cabinet_payer: null, cabinet_seat_subscription_id: null },
    { id: M1, email: "marc@x.ch", first_name: "Marc", last_name: "D", plan: "active", cabinet_role: "courtier", cabinet_root_id: "root-1", cabinet_payer: "cabinet", cabinet_seat_subscription_id: "sub_seat_marc" },
    { id: "other-1", email: "zoe@x.ch", first_name: "Zoé", last_name: "R", plan: "trial", cabinet_role: null, cabinet_root_id: null, cabinet_payer: null, cabinet_seat_subscription_id: null },
  ];
  cabinets = [{ root_id: "root-1", name: "Piliarys", address: null }];
  invites = [
    { id: "11111111-1111-4111-8111-111111111111", cabinet_root_id: "root-1", email: "lea@x.ch", first_name: "Léa", last_name: "Martin", payer: "cabinet", status: "pending", token: TOKEN, stripe_subscription_item_id: "sub_seat_lea", expires_at: future() },
  ];
  calls = [];
  emails = [];
  sessions = { "tok-root": "root-1", "tok-lea": "indep-1", "tok-zoe": "other-1", "tok-marc": M1 };
}

function filterRows(rows: Row[], query: URLSearchParams): Row[] {
  return rows.filter((r) => {
    for (const [k, v] of query.entries()) {
      if (k === "select" || k === "order" || k === "limit") continue;
      const val = r[k];
      if (v.startsWith("eq.")) {
        if (String(val) !== decodeURIComponent(v.slice(3))) return false;
      } else if (v.startsWith("ilike.")) {
        const pat = decodeURIComponent(v.slice(6)).replace(/\\(.)/g, "$1");
        if (String(val ?? "").toLowerCase() !== pat.toLowerCase()) return false;
      } else if (v.startsWith("in.(")) {
        if (!v.slice(4, -1).split(",").includes(String(val))) return false;
      }
    }
    return true;
  });
}

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const body = init?.body ? (() => { try { return JSON.parse(String(init.body)); } catch { return String(init.body); } })() : undefined;
  calls.push({ method, url: url.toString(), body });
  const ok = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

  if (url.pathname === "/auth/v1/user") {
    const tok = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace(/^Bearer\s+/, "");
    const uid = sessions[tok];
    const p = profiles.find((x) => x.id === uid);
    return uid && p ? ok({ id: uid, email: p.email }) : ok({}, 401);
  }
  if (url.pathname === "/auth/v1/admin/users") {
    const id = "new-user";
    profiles.push({ id, email: body.email, first_name: body.user_metadata.first_name, last_name: body.user_metadata.last_name, plan: "trial", cabinet_role: null, cabinet_root_id: null, cabinet_payer: null, cabinet_seat_subscription_id: null });
    return ok({ id });
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) return Promise.resolve(new Response(null, { status: 204 }));
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.slice("/rest/v1/".length);
    const store: Record<string, Row[]> = { profiles, cabinets, cabinet_invites: invites };
    const rows = store[table];
    if (!rows) return ok([], 201); // notifications, plan_events
    if (method === "GET") return ok(filterRows(rows, url.searchParams));
    if (method === "POST") {
      const row = { id: `22222222-2222-4222-8222-22222222222${rows.length}`, ...body };
      rows.push(row);
      return ok([row], 201);
    }
    if (method === "PATCH") {
      const hit = filterRows(rows, url.searchParams);
      hit.forEach((r) => Object.assign(r, body));
      return ok(hit);
    }
  }
  if (url.hostname === "api.stripe.com") {
    if (url.pathname === "/v1/checkout/sessions") return ok({ id: "cs_seat", url: "https://checkout.stripe.com/seat" });
    if (url.pathname === "/v1/customers") return ok({ data: [] });
    return ok({ id: "ok" });
  }
  if (url.hostname === "api.brevo.com") {
    emails.push({ to: body.to, subject: body.subject, html: body.htmlContent });
    return ok({}, 201);
  }
  throw new Error(`URL non mockée: ${method} ${url}`);
}

function call(action: string, payload: Record<string, unknown> = {}, session?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers.Authorization = `Bearer ${session}`;
  return handleCabinetRequest(
    new Request("https://edge.local/cabinet", { method: "POST", headers, body: JSON.stringify({ action, ...payload }) }),
    ENV,
  );
}

beforeEach(() => {
  baseState();
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("cabinet — droits", () => {
  it("sans session : seules les actions publiques répondent", async () => {
    const res = await call("invite", { email: "x@y.ch", first_name: "X", last_name: "Y", payer: "self" });
    expect(res.status).toBe(401);
  });

  it("un courtier qui n'est pas patron ne peut pas inviter", async () => {
    const res = await call("invite", { email: "x@y.ch", first_name: "X", last_name: "Y", payer: "self" }, "tok-zoe");
    expect(res.status).toBe(403);
  });

  it("un patron ne peut pas gérer le collaborateur d'un autre cabinet", async () => {
    profiles.push({ id: "root-2", email: "b@b.ch", plan: "active", cabinet_role: "root_director", cabinet_root_id: "root-2" });
    cabinets.push({ root_id: "root-2", name: "Autre" });
    sessions["tok-root2"] = "root-2";
    const res = await call("remove", { memberId: "33333333-3333-4333-8333-333333333333" }, "tok-root2");
    expect(res.status).toBe(404);
  });
});

describe("cabinet — création", () => {
  it("un courtier indépendant crée son cabinet et en devient le patron", async () => {
    const res = await call("create", { name: "Cabinet Zoé", address: "Rue 1, Genève" }, "tok-zoe");
    expect(res.status).toBe(200);
    expect(cabinets.find((c) => c.root_id === "other-1")).toMatchObject({ name: "Cabinet Zoé" });
    expect(profiles.find((p) => p.id === "other-1")).toMatchObject({ cabinet_role: "root_director", cabinet_root_id: "other-1" });
  });

  it("un collaborateur ne peut pas créer de cabinet", async () => {
    const res = await call("create", { name: "X" + "y" }, "tok-marc");
    expect(res.status).toBe(409);
  });
});

describe("cabinet — invitations", () => {
  it("cotisation payée par le collaborateur : invitation envoyée tout de suite", async () => {
    const res = await call("invite", { email: "Zoe@X.ch", first_name: "Zoé", last_name: "R", payer: "self" }, "tok-root");
    expect(await res.json()).toMatchObject({ ok: true, status: "pending" });
    const inv = invites.find((i) => i.email === "zoe@x.ch");
    expect(inv).toMatchObject({ status: "pending", payer: "self", role: "courtier" });
    expect(emails).toHaveLength(1);
    expect(emails[0].html).toContain(`/rejoindre-cabinet/${inv!.token}`);
    expect(emails[0].html).toContain("reste à votre charge");
  });

  it("cotisation payée par le cabinet : le patron paie d'abord le siège, aucun e-mail avant le paiement", async () => {
    const res = await call("invite", { email: "zoe@x.ch", first_name: "Zoé", last_name: "R", payer: "cabinet" }, "tok-root");
    const body = await res.json();
    expect(body).toMatchObject({ status: "awaiting_payment", checkoutUrl: "https://checkout.stripe.com/seat" });
    expect(emails).toHaveLength(0);
    const checkout = calls.find((c) => c.url.endsWith("/v1/checkout/sessions"));
    const params = new URLSearchParams(String(checkout!.body));
    expect(params.get("subscription_data[metadata][kind]")).toBe("cabinet_seat");
    expect(params.get("customer_email")).toBe("james@piliarys.ch");
  });

  it("refuse d'inviter un collaborateur déjà membre ou une invitation en double", async () => {
    expect((await call("invite", { email: "marc@x.ch", first_name: "M", last_name: "D", payer: "self" }, "tok-root")).status).toBe(409);
    expect((await call("invite", { email: "lea@x.ch", first_name: "L", last_name: "M", payer: "self" }, "tok-root")).status).toBe(409);
  });

  it("renvoyer une invitation : nouveau lien, l'ancien ne marche plus", async () => {
    const res = await call("resend", { inviteId: invites[0].id }, "tok-root");
    expect(res.status).toBe(200);
    expect(invites[0].token).not.toBe(TOKEN);
    expect((await call("info", { token: TOKEN })).status).toBe(404);
  });
});

describe("cabinet — adhésion", () => {
  it("affiche l'invitation et signale qu'un compte existe déjà", async () => {
    const res = await call("info", { token: TOKEN });
    expect(await res.json()).toMatchObject({ cabinetName: "Piliarys", payer: "cabinet", accountExists: true });
  });

  it("un autre compte ne peut pas utiliser l'invitation", async () => {
    const res = await call("accept", { token: TOKEN }, "tok-zoe");
    expect(res.status).toBe(403);
    expect(invites[0].status).toBe("pending");
  });

  it("le bon compte rejoint le cabinet ; cotisation prise en charge par le siège", async () => {
    const res = await call("accept", { token: TOKEN }, "tok-lea");
    expect(res.status).toBe(200);
    expect(profiles.find((p) => p.id === "indep-1")).toMatchObject({
      cabinet_role: "courtier",
      cabinet_root_id: "root-1",
      cabinet_payer: "cabinet",
      cabinet_seat_subscription_id: "sub_seat_lea",
      brokerage_name: "Piliarys",
      plan: "active",
    });
    expect(invites[0].status).toBe("accepted");
    // Son abonnement personnel n'est plus renouvelé (recherche Stripe faite).
    expect(calls.some((c) => c.url.includes("api.stripe.com/v1/customers?email="))).toBe(true);
    // Deuxième utilisation refusée.
    expect((await call("accept", { token: TOKEN }, "tok-lea")).status).toBe(410);
  });

  it("nouvelle personne : création du compte depuis l'invitation", async () => {
    invites[0].email = "nouveau@x.ch";
    const res = await call("signup_accept", { token: TOKEN, password: "motdepasse1", first_name: "Nina", last_name: "K" });
    expect(res.status).toBe(200);
    expect(profiles.find((p) => p.id === "new-user")).toMatchObject({ cabinet_role: "courtier", cabinet_root_id: "root-1", plan: "active" });
  });

  it("invitation expirée : refus", async () => {
    invites[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await call("info", { token: TOKEN })).status).toBe(410);
    expect((await call("accept", { token: TOKEN }, "tok-lea")).status).toBe(410);
  });
});

describe("cabinet — départ d'un collaborateur", () => {
  it("ses clients restent au cabinet, son siège s'arrête, son accès est coupé", async () => {
    const res = await call("remove", { memberId: M1 }, "tok-root");
    expect(res.status).toBe(200);
    const rpc = calls.find((c) => c.url.includes("/rpc/cabinet_transfer_member_data"));
    expect(rpc?.body).toEqual({ _member: M1, _root: "root-1" });
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/v1/subscriptions/sub_seat_marc"))).toBe(true);
    expect(profiles.find((p) => p.id === M1)).toMatchObject({ cabinet_role: null, cabinet_root_id: null, plan: "expired" });
  });

  it("passer un collaborateur à ses frais : effectif au renouvellement", async () => {
    const res = await call("set_payer", { memberId: M1, payer: "self" }, "tok-root");
    expect(await res.json()).toMatchObject({ effective: "renewal" });
    const upd = calls.find((c) => c.url.endsWith("/v1/subscriptions/sub_seat_marc") && c.method === "POST");
    expect(String(upd?.body)).toContain("cancel_at_period_end=true");
    expect(profiles.find((p) => p.id === M1)).toMatchObject({ plan: "active", cabinet_payer: "cabinet" });
  });
});
