import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyRouter } from "@tanstack/react-router";
import type { ConsentRecord } from "@/lib/consent";

// Le module lit VITE_GA_MEASUREMENT_ID une seule fois, au chargement — on
// doit donc réinitialiser les modules et le réimporter dynamiquement après
// chaque vi.stubEnv() pour tester les deux configurations (ID présent/absent).
async function importAnalytics() {
  vi.resetModules();
  return import("./analytics");
}

function createFakeRouter(initialFullPath: string) {
  const listeners: Array<() => void> = [];
  const state = {
    matches: [{ fullPath: initialFullPath }],
    location: { pathname: initialFullPath },
  };
  const router = {
    state,
    subscribe: vi.fn((_eventType: string, fn: () => void) => {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }),
  } as unknown as AnyRouter;

  return {
    router,
    navigateTo(fullPath: string) {
      state.matches = [{ fullPath } as never];
      state.location = { pathname: fullPath } as never;
      listeners.forEach((fn) => fn());
    },
    listenerCount: () => listeners.length,
  };
}

function consent(overrides: Partial<ConsentRecord>): ConsentRecord {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    decidedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let gtagCalls: unknown[][] = [];
let appendedScripts: string[] = [];

beforeEach(() => {
  gtagCalls = [];
  appendedScripts = [];
  vi.stubGlobal("window", {
    location: { origin: "https://swissbrokerpro.ch" },
  });
  vi.stubGlobal("document", {
    title: "Calculateurs · SwissBroker Pro",
    createElement: vi.fn(() => {
      const el: { src?: string; async?: boolean } = {};
      return el;
    }),
    head: {
      appendChild: vi.fn((el: { src?: string }) => {
        if (el.src) appendedScripts.push(el.src);
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analytics: activation GA4", () => {
  it("ne charge rien tant que VITE_GA_MEASUREMENT_ID n'est pas configuré", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/");

    applyConsent(consent({ analytics: true }), router);

    expect(appendedScripts).toHaveLength(0);
  });

  it("charge gtag avec send_page_view désactivé une fois l'ID configuré et le consentement donné", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-4T2FE4GSNW");
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/dashboard");

    const w = window as unknown as { gtag: (...args: unknown[]) => void };
    applyConsent(consent({ analytics: true }), router);
    // Intercepte les appels gtag passés par le module (capturés via dataLayer).
    gtagCalls = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    void w;

    expect(appendedScripts).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-4T2FE4GSNW"]);
    expect(gtagCalls).toContainEqual(["config", "G-4T2FE4GSNW", { send_page_view: false }]);
  });
});

describe("analytics: consentement — activation/refus/retrait", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-4T2FE4GSNW");
  });

  it("sans consentement : aucun script, aucun page_view", async () => {
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/");

    applyConsent(consent({ analytics: false }), router);

    expect(appendedScripts).toHaveLength(0);
  });

  it("après refus explicite : aucun script chargé, même avec un ID valide", async () => {
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: false, marketing: false }), router);

    expect(appendedScripts).toHaveLength(0);
  });

  it("après acceptation : envoie exactement un page_view pour la page actuelle", async () => {
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), router);

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews).toHaveLength(1);
    expect(pageViews[0][2]).toMatchObject({
      page_location: "https://swissbrokerpro.ch/dashboard",
      page_title: "Calculateurs · SwissBroker Pro",
    });
  });

  it("après retrait du consentement : aucun page_view supplémentaire sur les navigations suivantes", async () => {
    const { applyConsent } = await importAnalytics();
    const nav = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), nav.router);
    expect(nav.listenerCount()).toBe(1);

    applyConsent(consent({ analytics: false }), nav.router);
    expect(nav.listenerCount()).toBe(0);

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const countBefore = dataLayer.filter((c) => c[1] === "page_view").length;

    nav.navigateTo("/clients/$clientId");

    const countAfter = dataLayer.filter((c) => c[1] === "page_view").length;
    expect(countAfter).toBe(countBefore);
  });

  it("ne transmet jamais le chemin résolu (identifiants réels) : seul le pattern de route générique est envoyé", async () => {
    const { applyConsent } = await importAnalytics();
    const { router } = createFakeRouter("/clients/$clientId");

    applyConsent(consent({ analytics: true }), router);

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews[0][2]).toMatchObject({
      page_location: "https://swissbrokerpro.ch/clients/$clientId",
    });
  });
});

describe("analytics: navigation SPA", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-4T2FE4GSNW");
  });

  it("envoie exactement un page_view par navigation résolue vers une route différente", async () => {
    const { applyConsent } = await importAnalytics();
    const nav = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), nav.router);
    nav.navigateTo("/clients");
    nav.navigateTo("/clients/$clientId");

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews).toHaveLength(3); // page initiale + 2 navigations
    expect(pageViews.map((c) => (c[2] as { page_location: string }).page_location)).toEqual([
      "https://swissbrokerpro.ch/dashboard",
      "https://swissbrokerpro.ch/clients",
      "https://swissbrokerpro.ch/clients/$clientId",
    ]);
  });

  it("ne recompte pas une résolution de routeur qui ne change pas de route", async () => {
    const { applyConsent } = await importAnalytics();
    const nav = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), nav.router);
    nav.navigateTo("/dashboard"); // ex. résolution déclenchée par un changement de search params

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews).toHaveLength(1);
  });
});

describe("analytics: remontages de composant / changement de langue", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-4T2FE4GSNW");
  });

  it("un second appel à applyConsent (ex. remontage du bandeau au changement de langue) ne crée pas de second abonnement ni de second page_view", async () => {
    const { applyConsent } = await importAnalytics();
    const nav = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), nav.router);
    applyConsent(consent({ analytics: true }), nav.router);
    applyConsent(consent({ analytics: true }), nav.router);

    expect(nav.listenerCount()).toBe(1);

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews).toHaveLength(1);

    nav.navigateTo("/clients");
    const pageViewsAfterNav = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViewsAfterNav).toHaveLength(2);
  });

  it("après un retrait puis un nouveau consentement : reprend le suivi depuis la page actuelle, sans la recompter rétroactivement", async () => {
    const { applyConsent } = await importAnalytics();
    const nav = createFakeRouter("/dashboard");

    applyConsent(consent({ analytics: true }), nav.router);
    applyConsent(consent({ analytics: false }), nav.router);
    nav.navigateTo("/clients"); // navigation pendant le retrait : ne doit rien envoyer

    nav.navigateTo("/clients/$clientId"); // le visiteur redonne son accord ici
    applyConsent(consent({ analytics: true }), nav.router);

    const dataLayer = (window as unknown as { dataLayer: unknown[][] }).dataLayer;
    const pageViews = dataLayer.filter((call) => call[1] === "page_view");
    expect(pageViews.map((c) => (c[2] as { page_location: string }).page_location)).toEqual([
      "https://swissbrokerpro.ch/dashboard",
      "https://swissbrokerpro.ch/clients/$clientId",
    ]);
  });
});
