import { describe, it, expect } from "vitest";
import { extractErrorCode } from "./client-upload.$token";

// extractErrorCode est le point d'articulation entre supabase-js
// (functions.invoke) et l'affichage des messages ERROR_MESSAGES sur la page
// publique de depot de documents : c'est ce qui permet a l'appelant de
// distinguer LINK_EXPIRED de LINK_QUOTA_REACHED, etc., a partir de l'erreur
// HTTP renvoyee par l'Edge Function.
describe("extractErrorCode", () => {
  it("lit le code depuis error.context (Response) quand disponible", async () => {
    const context = new Response(JSON.stringify({ error: "LINK_EXPIRED" }), { status: 403 });
    const code = await extractErrorCode({ context });
    expect(code).toBe("LINK_EXPIRED");
  });

  it("retourne null si le corps ne contient pas de champ error", async () => {
    const context = new Response(JSON.stringify({ message: "autre chose" }), { status: 500 });
    const code = await extractErrorCode({ context });
    expect(code).toBeNull();
  });

  it("retourne null si error.context est absent (ex: erreur reseau pure)", async () => {
    const code = await extractErrorCode(new Error("network error"));
    expect(code).toBeNull();
  });

  it("retourne null si le corps n'est pas du JSON exploitable", async () => {
    const context = new Response("<html>not json</html>", { status: 502 });
    const code = await extractErrorCode({ context });
    expect(code).toBeNull();
  });
});
