// src/lib/analytics.ts
// Chargement conditionnel des scripts de mesure/marketing tiers, appelé
// uniquement après consentement (voir CookieConsentBanner). Chaque outil
// reste inactif tant que son identifiant n'est pas configuré en variable
// d'environnement (VITE_GA_MEASUREMENT_ID / VITE_META_PIXEL_ID /
// VITE_LINKEDIN_PARTNER_ID) : en leur absence, donner son consentement
// n'active rien, il n'y a simplement rien à charger.
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
  // IP anonymisée : cohérent avec un service destiné à des utilisateurs
  // suisses/européens, réduit la donnée personnelle réellement collectée.
  w.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
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

export function applyConsent(consent: ConsentRecord): void {
  if (consent.analytics) loadGoogleAnalytics();
  if (consent.marketing) {
    loadMetaPixel();
    loadLinkedInInsight();
  }
}
