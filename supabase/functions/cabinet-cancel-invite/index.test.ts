import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCabinetCancelInviteRequest, type Env } from "./index";

// Avant le correctif : `requesterId` venait du body. La vérification
// "invite.invited_by !== requesterId" existait déjà, mais reposait sur une
// valeur que l'appelant choisissait lui-même — un attaquant connaissant
// l'UUID d'un directeur pouvait toujours se faire passer pour lui.

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
};

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/cabinet-cancel-invite", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const invites: Record<
  string,
  { invited_by: string; status: string; stripe_subscription_item_id: string | null }
> = {
  "invite-1": { invited_by: "director-A", status: "pending", stripe_subscription_item_id: null },
};

let patched: unknown[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url.includes("/rest/v1/cabinet_invites?id=eq.") && method === "GET") {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const inv = invites[id];
    return Promise.resolve(new Response(JSON.stringify(inv ? [inv] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/cabinet_invites?id=eq.") && method === "PATCH") {
    patched.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  patched = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("cabinet-cancel-invite — identité dérivée du JWT", () => {
  it("un requesterId falsifié dans le body est ignoré : impossible d'annuler l'invitation d'un autre", async () => {
    // director-B tente d'annuler l'invitation de director-A en mentant
    // dans le body : ça doit être refusé, quel que soit requesterId envoyé.
    const req = reqWithAuth("director-B", { inviteId: "invite-1", requesterId: "director-A" });
    const res = await handleCabinetCancelInviteRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("propres invitations");
    expect(patched).toHaveLength(0);
  });

  it("le vrai propriétaire de l'invitation peut toujours l'annuler", async () => {
    const req = reqWithAuth("director-A", { inviteId: "invite-1" });
    const res = await handleCabinetCancelInviteRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(patched).toHaveLength(1);
    expect(patched[0]).toMatchObject({ status: "revoked" });
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleCabinetCancelInviteRequest(
      reqWithAuth(null, { inviteId: "invite-1" }),
      ENV,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });
});
