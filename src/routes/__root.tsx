import {
  Outlet,
  Link,
  createRootRoute,
} from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { ActiveClientProvider } from "@/contexts/ActiveClientContext";
import { PlanProvider } from "@/contexts/PlanContext";
import { GuideProvider } from "@/contexts/GuideContext";
import { t as translate } from "@/lib/i18n";

const rootSearchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

function NotFoundComponent() {
  const t = translate;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("notfound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notfound.desc")}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("notfound.cta")}
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  validateSearch: zodValidator(rootSearchSchema),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function LanguageScopedTree() {
  const { lang } = useLanguage();
  return (
    <div key={lang} className="contents">
      <Outlet />
      <Toaster richColors position="top-right" />
    </div>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlanProvider>
        <GuideProvider>
        <ActiveClientProvider>
        <LanguageProvider>
          <LanguageScopedTree />
        </LanguageProvider>
        </ActiveClientProvider>
        </GuideProvider>
        </PlanProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}