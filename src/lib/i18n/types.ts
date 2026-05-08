export type AppLanguage = "fr" | "de" | "en" | "it";

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["fr", "de", "en", "it"];

export const LANGUAGE_META: Record<
  AppLanguage,
  { code: string; flag: string; nativeLabel: string }
> = {
  fr: { code: "FR", flag: "🇫🇷", nativeLabel: "Français" },
  de: { code: "DE", flag: "🇩🇪", nativeLabel: "Deutsch" },
  en: { code: "EN", flag: "🇬🇧", nativeLabel: "English" },
  it: { code: "IT", flag: "🇮🇹", nativeLabel: "Italiano" },
};
