import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCompleteOnboardingRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

const VALID_TOKEN = "a".repeat(32);
const validBody = {
  token: VALID_TOKEN,
  password: "motdepasse123",
  first_name: "Jean",
  last_name: "Dupont",
};

function req(body: Record<string, unknown>): Request {
  return new Request("https://edge.local/complete-onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let inviteState: { plan: string; email: string; claimed: boolean; released: boolean } = {
  plan: "active",
  email: "jean@x.ch",
  claimed: false,
  released: false,
};
let createdUser: Record<string, unknown> | null = null;
let patchedProfile: Record<string, unknown> | null = null;
let deletedUserId: string | null = null;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/client_invites?token=eq.") && method === "PATCH") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.used_at === null) {
      inviteState.released = true;
      inviteState.claimed = false;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    // Réclamation : ne matche que si pas déjà réclamée.
    if (inviteState.claimed) {
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }
    inviteState.claimed = true;
    return Promise.resolve(
      new Response(JSON.stringify([{ plan: inviteState.plan, email: inviteState.email }]), {
        status: 200,
      }),
    );
  }
  if (url.includes("/rest/v1/client_invites?token=eq.") && method === "GET") {
    return Promise.resolve(
      new Response(
        JSON.stringify([{ revoked: false, expires_at: "2099-01-01T00:00:00Z", used_at: null }]),
        { status: 200 },
      ),
    );
  }
  if (url === "https://fake.supabase.co/auth/v1/admin/users" && method === "POST") {
    createdUser = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(new Response(JSON.stringify({ id: "new-user-1" }), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?id=eq.") && method === "PATCH") {
    patchedProfile = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/auth/v1/admin/users/") && method === "DELETE") {
    deletedUserId = url.split("/").pop() ?? null;
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  inviteState = { plan: "active", email: "jean@x.ch", claimed: false, released: false };
  createdUser = null;
  patchedProfile = null;
  deletedUserId = null;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("complete-onboarding — cotisation annuelle", () => {
  it("crée le compte et applique le plan 'active' de l'invitation", async () => {
    const res = await handleCompleteOnboardingRequest(req(validBody), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(createdUser?.email).toBe("jean@x.ch");
    expect(patchedProfile?.plan).toBe("active");
  });

  it("une invitation historique (plan obsolète, ex. 'starter') est refusée, pas silencieusement acceptée", async () => {
    inviteState.plan = "starter";
    const res = await handleCompleteOnboardingRequest(req(validBody), ENV);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("INVITE_PLAN_OBSOLETE");
    expect(createdUser).toBeNull();
    // Le jeton est relâché : la personne peut être réinvitée proprement.
    expect(inviteState.released).toBe(true);
  });

  it("mot de passe trop court -> refus avant toute réclamation du jeton", async () => {
    const res = await handleCompleteOnboardingRequest(
      req({ ...validBody, password: "court" }),
      ENV,
    );
    expect(res.status).toBe(400);
    expect(inviteState.claimed).toBe(false);
  });
});
