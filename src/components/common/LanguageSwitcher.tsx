import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGE_META, SUPPORTED_LANGUAGES, type AppLanguage } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const current = LANGUAGE_META[lang];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/80"
          aria-label={t("lang.label")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-base leading-none">{current.flag}</span>
          <span className="text-xs font-semibold tracking-wide">{current.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {SUPPORTED_LANGUAGES.map((code: AppLanguage) => {
          const meta = LANGUAGE_META[code];
          const active = code === lang;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => setLang(code)}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{meta.flag}</span>
                <span>{meta.nativeLabel}</span>
              </span>
              {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
