import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleDemoMagicLinkRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null): Request {
  const headers: Record<string, string> = {};
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/demo-magic-link", { method: "POST", headers });
}

const profiles: Record<string, { email: string; plan: string }> = {
  "user-demo": { email: "demo@swissbrokerpro.ch", plan: "demo" },
  "user-pro": { email: "real@courtier.ch", plan: "pro" },
};

let generateLinkCalls: unknown[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url.includes("/rest/v1/profiles?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/auth/v1/admin/generate_link")) {
    generateLinkCalls.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(
      new Response(JSON.stringify({ properties: { action_link: "https://fake.supabase.co/auth/v1/verify?token=xyz" } }), { status: 200 }),
    );
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  generateLinkCalls = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("demo-magic-link — réservé aux comptes plan='demo', email dérivé du JWT uniquement", () => {
  it("compte plan='demo' -> génère un lien magiclink pour SON PROPRE email", async () => {
    const res = await handleDemoMagicLinkRequest(reqWithAuth("user-demo"), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, actionLink: expect.stringContaining("token=xyz") });
    expect(generateLinkCalls[0]).toMatchObject({
      type: "magiclink",
      email: "demo@swissbrokerpro.ch",
      redirect_to: "https://swissbrokerpro.ch/dashboard",
    });
  });

  it("compte de production (plan≠demo) -> refusé, aucun lien généré", async () => {
    const res = await handleDemoMagicLinkRequest(reqWithAuth("user-pro"), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux comptes en mode démo");
    expect(generateLinkCalls).toHaveLength(0);
  });

  it("sans Authorization -> refusé", async () => {
    const res = await handleDemoMagicLinkRequest(reqWithAuth(null), ENV);
    expect(res.status).toBe(500);
    expect(generateLinkCalls).toHaveLength(0);
  });
});
