// Gabarit commun aux 7 pages légales publiques (mentions légales, CGV,
// confidentialité, cookies, DPA, notice IA, registre des sous-traitants).
// Contenu transcrit tel quel depuis les documents fournis par le cabinet :
// volontairement en français uniquement (texte juridique engageant), quelle
// que soit la langue choisie ailleurs dans l'application.
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import logoFull from "@/assets/logo-full.png";
import { LEGAL_PAGES } from "@/lib/legal/pages";

export type LegalBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export function LegalPageLayout({
  title,
  updated,
  blocks,
}: {
  title: string;
  updated: string;
  blocks: LegalBlock[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src={logoIcon} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            <img src={logoFull} alt="SwissBroker Pro" className="h-5 w-auto shrink-0 object-contain" />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Dernière mise à jour : {updated}</p>

        <div className="mt-8 space-y-4">
          {blocks.map((block, i) => {
            if (block.type === "h2") {
              return (
                <h2 key={i} className="!mt-10 text-lg font-semibold text-foreground">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "h3") {
              return (
                <h3 key={i} className="!mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {block.text}
                </h3>
              );
            }
            if (block.type === "p") {
              return (
                <p key={i} className="text-sm leading-relaxed text-foreground/90">
                  {block.text}
                </p>
              );
            }
            if (block.type === "ul") {
              return (
                <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            }
            // table
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 font-semibold text-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/60 last:border-0 even:bg-muted/20">
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2 align-top text-foreground/90">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <nav className="mt-14 border-t border-border/60 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autres documents légaux</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {LEGAL_PAGES.map((p) => (
              <li key={p.path}>
                <Link to={p.path} className="text-primary underline-offset-2 hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
