// src/components/billing/AdvantagesContent.tsx
// Contenu partagé (fenêtre "Avantages" post-paiement + onglet "Avantages" du
// profil) : explication des ristournes et de la commission 40-50‰. Jamais
// affiché avant le paiement, jamais sur la landing page, voir AdvantagesModal
// et account.tsx.
export const CALCOM_ADVANTAGES_URL =
  "https://cal.com/swissbroker/presentation-de-vos-avantages-swissbroker-pro";

export function AdvantagesContent() {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold">Prise en charge des ristournes</h3>
        <p className="mt-1 text-muted-foreground">
          Un système de prise en charge des ristournes est mis en place sur une base mensuelle,
          selon le pourcentage de ristournes accordé par le courtier :
        </p>
        <ul className="mt-2 space-y-1.5 text-muted-foreground">
          <li>
            <strong className="text-foreground">De 0 % à 10 % de ristournes :</strong> la structure
            prend en charge 100 % du montant. Rien à votre charge.
          </li>
          <li>
            <strong className="text-foreground">De 11 % à 20 % de ristournes :</strong> la structure
            prend en charge 50 %. Les 50 % restants sont à votre charge.
          </li>
          <li>
            <strong className="text-foreground">À partir de 21 % de ristournes :</strong> aucune
            prise en charge, l'intégralité est à votre charge.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Commission de 40 à 50‰ (4 à 5 %)</h3>
        <p className="mt-1 text-muted-foreground">
          Une réserve de 15 % est conservée par la société sur un compte "storno", pour couvrir
          d'éventuelles reprises de commission en cas de résiliation ou d'annulation d'un contrat.
          Exemple sur une prime annuelle de 10'000 CHF : commission brute de 400 à 500 CHF, dont 60
          à 75 CHF de réserve storno, soit 340 à 425 CHF versés immédiatement.
        </p>
      </div>
    </div>
  );
}
