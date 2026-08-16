import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleClientUploadRequest,
  sanitizeFilename,
  errorCodeFromMessage,
  _resetRateLimitForTests,
  MAX_FILE_SIZE_BYTES,
  type Env,
} from "./index";

// Ce fichier teste le contrat de securite de l'Edge Function client-upload
// (celle qui remplace l'ancienne route TanStack Start jamais executee en
// production) sans dependre d'un vrai projet Supabase : `fetch` est mocke
// pour simuler PostgREST (RPC get_upload_link_info / register_client_upload,
// table client_document_links) et l'API Storage, en reproduisant fidelement
// les regles de la migration 20260519141738_...sql (expiration, quota,
// revocation, association client_id/broker_id derivee du token).

const SUPABASE_URL = "https://fake.supabase.co";
const SERVICE_KEY = "fake-service-role-key";
const ENV: Env = { supabaseUrl: SUPABASE_URL, supabaseKey: SERVICE_KEY };

type LinkRow = {
  id: string;
  token: string;
  client_id: string;
  broker_id: string;
  revoked: boolean;
  expires_at: string;
  max_uploads: number;
  upload_count: number;
};

type DocRow = {
  id: string;
  client_id: string;
  broker_id: string;
  category: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: "client_link";
  upload_link_id: string;
};

let links: LinkRow[];
let documents: DocRow[];
let storageObjects: Set<string>;

function seedLink(overrides: Partial<LinkRow> = {}): LinkRow {
  const link: LinkRow = {
    id: crypto.randomUUID(),
    token: "a".repeat(32),
    client_id: "client-1",
    broker_id: "broker-1",
    revoked: false,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    max_uploads: 5,
    upload_count: 0,
    ...overrides,
  };
  links.push(link);
  return link;
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(65);
  return new File([content], name, { type });
}

// Simule public.get_upload_link_info (SECURITY DEFINER)
function simulateGetUploadLinkInfo(token: string): { status: number; body: unknown } {
  const link = links.find((l) => l.token === token);
  if (!link) return { status: 400, body: { message: "LINK_NOT_FOUND" } };
  if (link.revoked) return { status: 400, body: { message: "LINK_REVOKED" } };
  if (new Date(link.expires_at) < new Date())
    return { status: 400, body: { message: "LINK_EXPIRED" } };
  if (link.upload_count >= link.max_uploads)
    return { status: 400, body: { message: "LINK_QUOTA_REACHED" } };
  return {
    status: 200,
    body: [
      {
        link_id: link.id,
        client_first_name: "Jean",
        broker_display: "Marie Courtier",
        expires_at: link.expires_at,
        uploads_remaining: link.max_uploads - link.upload_count,
      },
    ],
  };
}

// Simule public.register_client_upload : revalidation atomique puis
// insert + increment de quota. C'est la garde-fou definitive.
function simulateRegisterClientUpload(params: Record<string, string>): {
  status: number;
  body: unknown;
} {
  const link = links.find((l) => l.token === params._token);
  if (!link) return { status: 400, body: { message: "LINK_NOT_FOUND" } };
  if (link.revoked) return { status: 400, body: { message: "LINK_REVOKED" } };
  if (new Date(link.expires_at) < new Date())
    return { status: 400, body: { message: "LINK_EXPIRED" } };
  if (link.upload_count >= link.max_uploads)
    return { status: 400, body: { message: "LINK_QUOTA_REACHED" } };

  const docId = crypto.randomUUID();
  documents.push({
    id: docId,
    client_id: link.client_id,
    broker_id: link.broker_id,
    category: params._category,
    original_filename: params._original_filename,
    storage_path: params._storage_path,
    mime_type: params._mime_type,
    size_bytes: Number(params._size_bytes),
    uploaded_by: "client_link",
    upload_link_id: link.id,
  });
  link.upload_count += 1;
  return { status: 200, body: docId };
}

async function baseMockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/rpc/get_upload_link_info")) {
    const { _token } = JSON.parse(String(init?.body ?? "{}"));
    const { status, body } = simulateGetUploadLinkInfo(_token);
    return new Response(JSON.stringify(body), { status });
  }

  if (url.includes("/rest/v1/rpc/register_client_upload")) {
    const params = JSON.parse(String(init?.body ?? "{}"));
    const { status, body } = simulateRegisterClientUpload(params);
    return new Response(JSON.stringify(body), { status });
  }

  if (url.includes("/rest/v1/client_document_links")) {
    const tokenMatch = url.match(/token=eq\.([^&]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
    const link = links.find((l) => l.token === token);
    return new Response(JSON.stringify(link ? [link] : []), { status: 200 });
  }

  if (url.includes("/storage/v1/object/client-documents/")) {
    const path = url.split("/storage/v1/object/client-documents/")[1];
    if (method === "POST") {
      storageObjects.add(path);
      return new Response(JSON.stringify({ Key: path }), { status: 200 });
    }
    if (method === "DELETE") {
      storageObjects.delete(path);
      return new Response(JSON.stringify({}), { status: 200 });
    }
  }

  throw new Error(`URL non mockee dans le test: ${method} ${url}`);
}

beforeEach(() => {
  links = [];
  documents = [];
  storageObjects = new Set();
  _resetRateLimitForTests();
  vi.stubGlobal("fetch", vi.fn(baseMockFetch));
});

function infoRequest(token: string): Request {
  return new Request("https://edge.local/client-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

function uploadRequest(fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request("https://edge.local/client-upload", { method: "POST", body: form });
}

describe("client-upload edge function — consultation du lien", () => {
  it("token valide -> retourne les infos du lien", async () => {
    const link = seedLink();
    const res = await handleClientUploadRequest(infoRequest(link.token), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      clientFirstName: "Jean",
      brokerDisplay: "Marie Courtier",
      uploadsRemaining: 5,
    });
  });

  it("token invalide (trop court) -> refus sans toucher la base", async () => {
    const res = await handleClientUploadRequest(infoRequest("trop-court"), ENV);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_TOKEN");
  });

  it("token inexistant -> LINK_NOT_FOUND", async () => {
    const res = await handleClientUploadRequest(infoRequest("z".repeat(32)), ENV);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("LINK_NOT_FOUND");
  });

  it("token expire -> refus", async () => {
    const link = seedLink({ expires_at: new Date(Date.now() - 1000).toISOString() });
    const res = await handleClientUploadRequest(infoRequest(link.token), ENV);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("LINK_EXPIRED");
  });

  it("quota deja epuise -> refus", async () => {
    const link = seedLink({ max_uploads: 2, upload_count: 2 });
    const res = await handleClientUploadRequest(infoRequest(link.token), ENV);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("LINK_QUOTA_REACHED");
  });

  it("lien revoque -> refus", async () => {
    const link = seedLink({ revoked: true });
    const res = await handleClientUploadRequest(infoRequest(link.token), ENV);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("LINK_REVOKED");
  });

  it("aucune authentification requise : le token seul suffit", async () => {
    const link = seedLink();
    const req = infoRequest(link.token);
    expect(req.headers.get("authorization")).toBeNull();
    const res = await handleClientUploadRequest(req, ENV);
    expect(res.status).toBe(200);
  });
});

describe("client-upload edge function — depot de fichier", () => {
  it("upload valide -> document cree, associe au bon client, quota incremente", async () => {
    const link = seedLink({ client_id: "client-42", broker_id: "broker-7" });
    const file = makeFile("releve.pdf", "application/pdf", 1024);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "fiche_salaire", file }),
      ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("releve.pdf");
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      client_id: "client-42",
      broker_id: "broker-7",
      category: "fiche_salaire",
      uploaded_by: "client_link",
    });
    expect(documents[0].storage_path.startsWith("broker-7/client-42/fiche_salaire/")).toBe(true);
    expect(storageObjects.size).toBe(1);
    const updatedLink = links.find((l) => l.token === link.token)!;
    expect(updatedLink.upload_count).toBe(1);
  });

  it("un clientId falsifie dans le formulaire est ignore : seul le token determine le client", async () => {
    const link = seedLink({ client_id: "client-real", broker_id: "broker-real" });
    const file = makeFile("doc.pdf", "application/pdf", 512);
    const res = await handleClientUploadRequest(
      uploadRequest({
        token: link.token,
        category: "autres",
        file,
        clientId: "client-attaquant",
      }),
      ENV,
    );
    expect(res.status).toBe(200);
    expect(documents[0].client_id).toBe("client-real");
    expect(documents[0].client_id).not.toBe("client-attaquant");
  });

  it("un token ne peut jamais lire ni affecter le quota/les documents d'un autre client", async () => {
    const linkA = seedLink({ token: "a".repeat(32), client_id: "client-A", broker_id: "broker-A" });
    const linkB = seedLink({ token: "b".repeat(32), client_id: "client-B", broker_id: "broker-B" });

    const fileA = makeFile("a.pdf", "application/pdf", 100);
    await handleClientUploadRequest(
      uploadRequest({ token: linkA.token, category: "autres", file: fileA }),
      ENV,
    );

    expect(documents).toHaveLength(1);
    expect(documents[0].client_id).toBe("client-A");

    const updatedLinkA = links.find((l) => l.token === linkA.token)!;
    const updatedLinkB = links.find((l) => l.token === linkB.token)!;
    expect(updatedLinkA.upload_count).toBe(1);
    expect(updatedLinkB.upload_count).toBe(0); // totalement inaffecte
  });

  it("fichier trop volumineux -> refus, rien n'est uploade ni enregistre", async () => {
    const link = seedLink();
    const file = makeFile("gros.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "autres", file }),
      ENV,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("FILE_TOO_LARGE");
    expect(documents).toHaveLength(0);
    expect(storageObjects.size).toBe(0);
  });

  it("type de fichier non autorise -> refus", async () => {
    const link = seedLink();
    const file = makeFile("script.exe", "application/x-msdownload", 100);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "autres", file }),
      ENV,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_TYPE");
  });

  it("categorie invalide -> refus", async () => {
    const link = seedLink();
    const file = makeFile("doc.pdf", "application/pdf", 100);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "categorie-inexistante", file }),
      ENV,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_CATEGORY");
  });

  it("fichier absent -> refus", async () => {
    const link = seedLink();
    const form = new FormData();
    form.append("token", link.token);
    form.append("category", "autres");
    const req = new Request("https://edge.local/client-upload", { method: "POST", body: form });
    const res = await handleClientUploadRequest(req, ENV);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("FILE_REQUIRED");
  });

  it("quota deja atteint -> refus avant meme d'uploader (fail-fast, pas de fichier orphelin)", async () => {
    const link = seedLink({ max_uploads: 1, upload_count: 1 });
    const file = makeFile("doc.pdf", "application/pdf", 100);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "autres", file }),
      ENV,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("LINK_QUOTA_REACHED");
    expect(storageObjects.size).toBe(0);
    expect(documents).toHaveLength(0);
  });

  it("garde-fou atomique : un upload concurrent consomme le quota entre le fail-fast et l'ecriture -> refus + rollback storage", async () => {
    const link = seedLink({ max_uploads: 1, upload_count: 0 });
    let firstLinkReadDone = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/rest/v1/client_document_links") && !firstLinkReadDone) {
          firstLinkReadDone = true;
          const res = await baseMockFetch(input, init);
          // Un autre upload "concurrent" consomme le quota juste apres
          // notre lecture (fail-fast), avant l'appel a register_client_upload.
          link.upload_count = link.max_uploads;
          return res;
        }
        return baseMockFetch(input, init);
      }),
    );

    const file = makeFile("doc.pdf", "application/pdf", 100);
    const res = await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "autres", file }),
      ENV,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("LINK_QUOTA_REACHED");
    // Le fichier avait ete stocke (fail-fast etait encore ok) puis retire :
    expect(storageObjects.size).toBe(0);
    expect(documents).toHaveLength(0);
  });

  it("le document enregistre correspond au contrat lu par DocumentsTab.tsx (DocRow)", async () => {
    const link = seedLink({ client_id: "client-99", broker_id: "broker-99" });
    const file = makeFile("piece.png", "image/png", 2048);
    await handleClientUploadRequest(
      uploadRequest({ token: link.token, category: "piece_identite", file }),
      ENV,
    );
    const doc = documents[0];
    for (const key of [
      "id",
      "client_id",
      "category",
      "original_filename",
      "storage_path",
      "mime_type",
      "size_bytes",
      "uploaded_by",
    ] as const) {
      expect(doc).toHaveProperty(key);
    }
    expect(doc.uploaded_by).toBe("client_link");
  });
});

describe("sanitizeFilename / errorCodeFromMessage", () => {
  it("neutralise les caracteres dangereux (ex: tentative de path traversal) et tronque a 120", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFilename("a".repeat(200)).length).toBe(120);
    expect(sanitizeFilename("")).toBe("fichier");
  });

  it("extrait le code LINK_* d'un message d'exception Postgres", () => {
    expect(errorCodeFromMessage("LINK_EXPIRED", "X")).toBe("LINK_EXPIRED");
    expect(errorCodeFromMessage(undefined, "FALLBACK")).toBe("FALLBACK");
    expect(errorCodeFromMessage("autre chose", "FALLBACK")).toBe("FALLBACK");
  });
});
