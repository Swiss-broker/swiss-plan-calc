// src/components/common/CookieConsentBanner.tsx
// Bandeau de consentement cookies (RGPD/nLPD), monté une fois à la racine
// de l'app (voir __root.tsx) : s'affiche tant qu'aucun choix n'est
// enregistré, et peut être rouvert à tout moment via le lien "Préférences
// cookies" du footer (openCookiePreferences()).
import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useT } from "@/contexts/LanguageContext";
import {
  loadConsent,
  saveConsent,
  OPEN_COOKIE_PREFERENCES_EVENT,
  type ConsentCategories,
} from "@/lib/consent";
import { applyConsent } from "@/lib/analytics";

export function CookieConsentBanner() {
  const t = useT();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>({ analytics: false, marketing: false });

  useEffect(() => {
    const existing = loadConsent();
    if (existing) {
      applyConsent(existing, router);
    } else {
      setVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleReopen() {
      const existing = loadConsent();
      setDraft({ analytics: existing?.analytics ?? false, marketing: existing?.marketing ?? false });
      setCustomizeOpen(true);
    }
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleReopen);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleReopen);
  }, []);

  function decide(categories: ConsentCategories) {
    const record = saveConsent(categories);
    applyConsent(record, router);
    setVisible(false);
    setCustomizeOpen(false);
  }

  function openCustomize() {
    const existing = loadConsent();
    setDraft({ analytics: existing?.analytics ?? false, marketing: existing?.marketing ?? false });
    setCustomizeOpen(true);
  }

  return (
    <>
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-card/95 backdrop-blur-sm shadow-elegant">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted-foreground">
              {t("cookies.banner.desc")}{" "}
              <Link to="/legal/cookies" className="underline hover:text-foreground">
                {t("cookies.banner.policyLink")}
              </Link>
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => decide({ analytics: false, marketing: false })}>
                {t("cookies.banner.refuseAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={openCustomize}>
                {t("cookies.banner.customize")}
              </Button>
              <Button size="sm" onClick={() => decide({ analytics: true, marketing: true })}>
                {t("cookies.banner.acceptAll")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cookies.prefs.title")}</DialogTitle>
            <DialogDescription>{t("cookies.prefs.desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold">{t("cookies.prefs.necessary.title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("cookies.prefs.necessary.desc")}</p>
              </div>
              <Switch checked disabled />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold">{t("cookies.prefs.analytics.title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("cookies.prefs.analytics.desc")}</p>
              </div>
              <Switch
                checked={draft.analytics}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, analytics: checked }))}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold">{t("cookies.prefs.marketing.title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("cookies.prefs.marketing.desc")}</p>
              </div>
              <Switch
                checked={draft.marketing}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, marketing: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => decide({ analytics: false, marketing: false })}>
              {t("cookies.banner.refuseAll")}
            </Button>
            <Button onClick={() => decide(draft)}>{t("cookies.prefs.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
