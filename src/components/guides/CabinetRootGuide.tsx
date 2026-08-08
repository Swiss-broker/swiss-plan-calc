import { Joyride, type Step, type EventData, type Controls, STATUS } from "react-joyride";
import { useGuide } from "@/contexts/GuideContext";
import { useEffect, useState } from "react";
const GUIDE_ID = "cabinet-root-intro";
const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Bienvenue, directeur principal",
    content:
      "Bienvenue ! Vous êtes le directeur principal de votre cabinet. Ce statut vous donne une vision complète sur toute votre structure.",
    showProgress: true,
  },
  {
    target: '[data-nav="/team"]',
    title: "Constituer votre équipe",
    content:
      "Depuis l'onglet Équipe, vous pouvez ajouter des directeurs ou des courtiers. Chaque ajout est facturé 290 CHF par mois.",
    showProgress: true,
  },
  {
    target: "body",
    placement: "center",
    title: "Le rôle des directeurs",
    content:
      "Un directeur que vous ajoutez peut à son tour constituer sa propre équipe de courtiers, en toute autonomie.",
    showProgress: true,
  },
  {
    target: "body",
    placement: "center",
    title: "Ce que voient vos directeurs",
    content:
      "Chaque directeur ne voit que sa propre équipe de courtiers, jamais celle des autres directeurs du cabinet.",
    showProgress: true,
  },
  {
    target: "body",
    placement: "center",
    title: "Votre vision d'ensemble",
    content:
      "Vous seul gardez la vue sur l'ensemble du cabinet : tous les directeurs, ainsi que tous les courtiers qu'ils ajoutent chacun de leur côté.",
    showProgress: true,
  },
];
export function CabinetRootGuide() {
  const { hasSeenGuide, markGuideSeen, isLoading } = useGuide();
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!isLoading && !hasSeenGuide(GUIDE_ID)) {
      const timer = setTimeout(() => setRun(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasSeenGuide]);
  const handleEvent = (data: EventData, _controls: Controls) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false);
      markGuideSeen(GUIDE_ID);
    }
  };
  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      locale={{
        back: "Précédent",
        close: "Fermer",
        last: "Terminer",
        next: "Suivant",
        skip: "Passer",
      }}
      styles={{
        buttonPrimary: { backgroundColor: "#0f766e" },
      }}
    />
  );
}
export { GUIDE_ID as CABINET_ROOT_GUIDE_ID, steps as cabinetRootSteps };