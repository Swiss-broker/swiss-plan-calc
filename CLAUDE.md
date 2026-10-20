# Instructions pour Claude

## Git

- Quand l'utilisateur demande de "pousser" / "push", pousser directement sur `main`, pas sur une branche de travail séparée. Ce n'est pas une exception ponctuelle : c'est la convention de ce dépôt, demandée explicitement par l'utilisateur.
- `main` est déployé automatiquement en production sur Vercel (alias `swissbrokerpro.ch`). Un push sur `main` est donc visible immédiatement par les utilisateurs réels — tester (tsc, vitest, build) avant de pousser.
