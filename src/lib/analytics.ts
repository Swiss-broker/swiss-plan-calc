// src/lib/analytics.ts
// Chargement conditionnel des scripts de mesure/marketing tiers, appelé
// uniquement après consentement (voir CookieConsentBanner). Chaque outil
// reste inactif tant que son identifiant n'est pas configuré en variable
// d'environnement (VITE_GA_MEASUREMENT_ID / VITE_META_PIXEL_ID /
// VITE_LINKEDIN_PARTNER_ID) : en leur absence, donner son consentement
// n'active rien, il n'y a simplement rien à charger.
import type { AnyRouter } from "@tanstack/react-router";
import type { ConsentRecord } from "@/lib/consent";

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const LINKEDIN_PARTNER_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;

export const trackingConfigured = {
  analytics: Boolean(GA_MEASUREMENT_ID),
  marketing: Boolean(META_PIXEL_ID || LINKEDIN_PARTNER_ID),
};

let gaLoaded = false;
let metaLoaded = false;
let linkedinLoaded = false;

function loadScript(src: string): void {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
}

function loadGoogleAnalytics(): void {
  if (gaLoaded || !GA_MEASUREMENT_ID) return;
  gaLoaded = true;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer.push(args);
  };
  w.gtag("js", new Date());
  // send_page_view désactivé : l'app est une SPA (TanStack Router, pas de
  // rechargement entre les routes), donc le page_view automatique de GA4 ne
  // couvrirait que la toute première page. Le suivi des pages vues est fait
  // manuellement par trackPageView(), sur chaque navigation résolue.
  // anonymize_ip est un paramètre historique d'Universal Analytics (GA3) :
  // GA4 n'en tient pas compte, l'anonymisation de l'IP y est native. Ne pas
  // le considérer comme une protection ; voir sanitizedPagePath() pour ce
  // qui protège réellement les données personnelles ici (aucune donnée
  // client/dossier/jeton n'est jamais transmise dans l'URL envoyée à GA).
  w.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
}

function gtagEvent(...args: unknown[]): void {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.(...args);
}

// Chemin "générique" de la route affichée (ex. "/clients/$clientId"), tel
// que défini dans le routeur — jamais le chemin résolu, qui contiendrait de
// vrais identifiants de client/dossier/entreprise ou des jetons d'accès
// (onboarding, dépôt de documents, partage). C'est la seule donnée de
// navigation envoyée à GA4.
function sanitizedPagePath(router: AnyRouter): string {
  const matches = router.state.matches;
  const leaf = matches[matches.length - 1];
  return leaf?.fullPath || router.state.location.pathname;
}

function trackPageView(path: string): void {
  if (!gaLoaded || !GA_MEASUREMENT_ID) return;
  gtagEvent("event", "page_view", {
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  });
}

let unsubscribePageViews: (() => void) | null = null;
let lastTrackedPath: string | null = null;

function startPageViewTracking(router: AnyRouter): void {
  // Déjà abonné (remontage de composant, changement de langue, double appel
  // React StrictMode en dev...) : ne rien refaire, pour ne jamais multiplier
  // les abonnements ni recompter la page déjà suivie.
  if (unsubscribePageViews) return;
  const initialPath = sanitizedPagePath(router);
  lastTrackedPath = initialPath;
  trackPageView(initialPath);
  unsubscribePageViews = router.subscribe("onResolved", () => {
    const path = sanitizedPagePath(router);
    if (path === lastTrackedPath) return;
    lastTrackedPath = path;
    trackPageView(path);
  });
}

function stopPageViewTracking(): void {
  unsubscribePageViews?.();
  unsubscribePageViews = null;
  lastTrackedPath = null;
}

// Snippet officiel Meta Pixel, réécrit sans IIFE auto-invoquée pour rester
// lisible et type-safe ; comportement strictement identique.
function loadMetaPixel(): void {
  if (metaLoaded || !META_PIXEL_ID) return;
  metaLoaded = true;
  type Fbq = {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    push: Fbq;
    loaded: boolean;
    version: string;
  };
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = fbq;
  w._fbq = fbq;
  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
  loadScript("https://connect.facebook.net/en_US/fbevents.js");
}

function loadLinkedInInsight(): void {
  if (linkedinLoaded || !LINKEDIN_PARTNER_ID) return;
  linkedinLoaded = true;
  const w = window as unknown as { _linkedin_partner_id: string; _linkedin_data_partner_ids: string[] };
  w._linkedin_partner_id = LINKEDIN_PARTNER_ID;
  w._linkedin_data_partner_ids = w._linkedin_data_partner_ids || [];
  w._linkedin_data_partner_ids.push(LINKEDIN_PARTNER_ID);
  loadScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
}

export function applyConsent(consent: ConsentRecord, router: AnyRouter): void {
  if (consent.analytics) {
    loadGoogleAnalytics();
    // Démarre le suivi à partir de la page actuellement affichée, jamais
    // rétroactivement sur les pages vues avant le consentement.
    startPageViewTracking(router);
  } else {
    // Consentement refusé ou retiré : on arrête immédiatement tout nouvel
    // envoi. Le script gtag déjà injecté ne peut pas être "déchargé" (aucune
    // page de ce site ne le recharge dynamiquement plusieurs fois), mais
    // sans abonnement actif, plus aucune donnée de navigation n'est émise —
    // comportement symétrique à celui déjà en place pour Meta/LinkedIn.
    stopPageViewTracking();
  }
  if (consent.marketing) {
    loadMetaPixel();
    loadLinkedInInsight();
  }
}
