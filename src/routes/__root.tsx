import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import appCss from "../styles.css?url";

// Search params globaux : `clientId` est conservé automatiquement entre
// les calculateurs lorsque le courtier navigue depuis la fiche client.
const rootSearchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  validateSearch: zodValidator(rootSearchSchema),
  search: {
    middlewares: [retainSearchParams(["clientId"])],
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SwissBroker Pro · Calculateur prévoyance & fiscalité suisse" },
      {
        name: "description",
        content:
          "L'outil tout-en-un pour les courtiers suisses : impôts, 2e pilier, 3e pilier, frontaliers et optimisation fiscale exacte par canton.",
      },
      { property: "og:title", content: "SwissBroker Pro · Calculateur prévoyance & fiscalité suisse" },
      {
        property: "og:description",
        content:
          "Calculateur exhaustif de prévoyance et d'optimisation fiscale suisse pour courtiers professionnels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "SwissBroker Pro · Calculateur prévoyance & fiscalité suisse" },
      { name: "description", content: "Swiss Pension Planner is a comprehensive financial calculator for Swiss insurance and pension brokers." },
      { property: "og:description", content: "Swiss Pension Planner is a comprehensive financial calculator for Swiss insurance and pension brokers." },
      { name: "twitter:description", content: "Swiss Pension Planner is a comprehensive financial calculator for Swiss insurance and pension brokers." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9012219-7461-46fd-997e-69624e4256ec/id-preview-8cf6f284--1e296310-17a8-48f0-800b-e1d24beffbf7.lovable.app-1777457430948.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9012219-7461-46fd-997e-69624e4256ec/id-preview-8cf6f284--1e296310-17a8-48f0-800b-e1d24beffbf7.lovable.app-1777457430948.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
