import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleSendClientEmailRequest, type Env } from "./index";

// Ce test couvre surtout le point de sécurité central : un courtier ne
// doit jamais pouvoir faire envoyer un email au client d'un AUTRE courtier
// en fournissant son clientId (le broker_id=eq. dans la requête clients
// doit filtrer ça avant tout envoi Brevo).

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  brevoKey: "fake-brevo-key",
};

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/send-client-email", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const clients: Record<string, { broker_id: string; email: string | null; first_name: string }> = {
  "client-A": { broker_id: "broker-A", email: "jean@example.ch", first_name: "Jean" },
  "client-noemail": { broker_id: "broker-A", email: null, first_name: "Sans-Email" },
};

let brevoSent: { to: string; subject: string }[] = [];
let loggedEmails: unknown[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);

  if (url.startsWith("https://api.brevo.com")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    brevoSent.push({ to: body.to?.[0]?.email, subject: body.subject });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  }

  if (url.includes("/rest/v1/clients?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const brokerFilter = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const c = clients[id];
    const match = c && c.broker_id === brokerFilter ? [c] : [];
    return Promise.resolve(new Response(JSON.stringify(match), { status: 200 }));
  }

  if (url.includes("/rest/v1/client_email_log")) {
    loggedEmails.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(new Response(null, { status: 201 }));
  }

  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  brevoSent = [];
  loggedEmails = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("send-client-email", () => {
  it("envoie bien au client du courtier appelant", async () => {
    const req = reqWithAuth("broker-A", { clientId: "client-A", subject: "Bonjour", body: "Contenu du message." });
    const res = await handleSendClientEmailRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(brevoSent).toEqual([{ to: "jean@example.ch", subject: "Bonjour" }]);
    expect(loggedEmails).toHaveLength(1);
  });

  it("clientId appartenant à un AUTRE courtier -> refus, aucun envoi", async () => {
    const req = reqWithAuth("broker-B", { clientId: "client-A", subject: "Bonjour", body: "Contenu." });
    const res = await handleSendClientEmailRequest(req, ENV);
    expect(res.status).toBe(500);
    const resBody = await res.json();
    expect(String(resBody.error)).toContain("n'existe pas ou ne vous appartient pas");
    expect(brevoSent).toHaveLength(0);
  });

  it("client sans adresse e-mail -> refus, aucun envoi", async () => {
    const req = reqWithAuth("broker-A", { clientId: "client-noemail", subject: "Bonjour", body: "Contenu." });
    const res = await handleSendClientEmailRequest(req, ENV);
    expect(res.status).toBe(500);
    const resBody = await res.json();
    expect(String(resBody.error)).toContain("pas d'adresse e-mail");
    expect(brevoSent).toHaveLength(0);
  });

  it("sans Authorization -> refus", async () => {
    const req = reqWithAuth(null, { clientId: "client-A", subject: "Bonjour", body: "Contenu." });
    const res = await handleSendClientEmailRequest(req, ENV);
    expect(res.status).toBe(500);
    const resBody = await res.json();
    expect(String(resBody.error)).toContain("Authentification requise");
    expect(brevoSent).toHaveLength(0);
  });

  it("sujet ou message vide -> refus", async () => {
    const req = reqWithAuth("broker-A", { clientId: "client-A", subject: "", body: "Contenu." });
    const res = await handleSendClientEmailRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(brevoSent).toHaveLength(0);
  });
});
