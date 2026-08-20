# SwissBroker Pro

Plateforme professionnelle pour courtiers en assurance et prévoyance suisses : calculs fiscaux exacts, optimisation LPP / 3e pilier, simulations frontaliers, comparateur cantonal et générateur de rapports PDF.

## Scope V1 — Suisse romande

La v1 cible exclusivement la **Suisse romande** : 6 cantons sélectionnables (GE, VD, VS, FR, NE, JU) plus **Zoug** comme canton de référence dans le comparateur cantonal.

Voir [`docs/SCOPE.md`](docs/SCOPE.md) pour le périmètre détaillé et la procédure d'ajout d'un canton en v1.5+.

## Stack technique

- **Framework** : React 19 + Vite 7 (SPA), déployé sur Vercel
- **Backend** : Lovable Cloud (Supabase managé)
- **Auth** : Supabase Auth (email + Google OAuth)
- **UI** : Tailwind CSS v4 + shadcn/ui + Recharts
- **PDF** : jsPDF + jspdf-autotable
- **i18n** : système maison léger (`src/lib/i18n/`)

## Architecture

```
src/
├── lib/
│   ├── swiss/cantons.ts        ← source de vérité cantons + flags selectable/comparable
│   ├── tax/                    ← moteur fiscal (IFD, ICC, fortune, source, frontaliers)
│   ├── lpp/                    ← prévoyance professionnelle
│   ├── optimizer/              ← suggestions d'optimisation fiscale
│   ├── pdf/                    ← export rapports PDF
│   ├── i18n/                   ← traductions FR + helpers de format CHF
│   └── format.ts
├── routes/
│   └── _app/calculators/       ← calculateurs (income-tax, source-tax, lpp, 3a, ...)
├── components/
│   ├── calculators/            ← UI réutilisable des calculateurs
│   └── ui/                     ← shadcn primitives
└── integrations/supabase/      ← client + types (auto-générés, ne pas éditer)
```

## Démarrage

```bash
bun install
bun run dev
```

L'app est disponible sur `http://localhost:5173`.

## Ajouter un canton (v1.5+)

Suivre la checklist dans [`docs/SCOPE.md`](docs/SCOPE.md) (étapes a → f).

## Garde-fous

- Cohérence flags ↔ types figés vérifiée au boot (`src/lib/swiss/cantons.ts`).
- Le comparateur cantonal ignore silencieusement (warn console) tout canton `comparable` sans barème chargé, plutôt que crasher.
- Tous les sélecteurs UI passent par `getSelectableCantons()`.
