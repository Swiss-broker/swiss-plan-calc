import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleSendAdvantagesReminderEmailsRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  brevoKey: "fake-brevo-key",
  siteUrl: "https://app.fake.ch",
};

function req(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-internal-token"] = token;
  return new Request("https://edge.local/send-advantages-reminder-emails", {
    method: "POST",
    headers,
  });
}

let authorized = true;
let dueProfiles: Array<{ id: string; email: string; first_name: string | null }> = [];
let sentEmails: Array<{ to: string; subject: string }> = [];
let patchedProfiles: Array<{ url: string; body: Record<string, unknown> }> = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/rpc/verify_internal_alert_token")) {
    return Promise.resolve(new Response(JSON.stringify(authorized), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles") && method === "GET") {
    return Promise.resolve(new Response(JSON.stringify(dueProfiles), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles") && method === "PATCH") {
    patchedProfiles.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url === "https://api.brevo.com/v3/smtp/email") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    sentEmails.push({ to: body.to[0].email, subject: body.subject });
    return Promise.resolve(new Response(JSON.stringify({ messageId: "fake" }), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  authorized = true;
  dueProfiles = [];
  sentEmails = [];
  patchedProfiles = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("send-advantages-reminder-emails", () => {
  it("refuse sans jeton interne valide", async () => {
    authorized = false;
    dueProfiles = [{ id: "broker-1", email: "a@b.ch", first_name: "Alex" }];
    const res = await handleSendAdvantagesReminderEmailsRequest(req("mauvais-jeton"), ENV);
    expect(res.status).toBe(401);
    expect(sentEmails).toHaveLength(0);
  });

  it("aucun courtier dû : aucun email envoyé", async () => {
    const res = await handleSendAdvantagesReminderEmailsRequest(req("bon-jeton"), ENV);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it("envoie le rappel à chaque courtier dû et marque la date d'envoi", async () => {
    dueProfiles = [
      { id: "broker-1", email: "alex@cabinet.ch", first_name: "Alex" },
      { id: "broker-2", email: "sam@cabinet.ch", first_name: "Sam" },
    ];
    const res = await handleSendAdvantagesReminderEmailsRequest(req("bon-jeton"), ENV);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(sentEmails.map((e) => e.to)).toEqual(["alex@cabinet.ch", "sam@cabinet.ch"]);
    expect(patchedProfiles).toHaveLength(2);
    expect(patchedProfiles[0].url).toContain("id=eq.broker-1");
    expect(patchedProfiles[0].body).toHaveProperty("advantages_email_last_sent_at");
  });

  it("filtre sur plan actif, case non cochée, et pas de rappel dans les 30 derniers jours", async () => {
    await handleSendAdvantagesReminderEmailsRequest(req("bon-jeton"), ENV);
    const callUrl = (
      globalThis.fetch as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls.find(
      (c) =>
        String(c[0]).includes("/rest/v1/profiles") && (c[1] as RequestInit)?.method !== "PATCH",
    )?.[0] as string;
    expect(callUrl).toContain("plan=eq.active");
    expect(callUrl).toContain("advantages_call_done=eq.false");
    expect(callUrl).toContain("advantages_email_last_sent_at.is.null");
  });

  it("ignore un profil sans email plutôt que de planter", async () => {
    dueProfiles = [{ id: "broker-1", email: "", first_name: "Alex" }];
    const res = await handleSendAdvantagesReminderEmailsRequest(req("bon-jeton"), ENV);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });
});
