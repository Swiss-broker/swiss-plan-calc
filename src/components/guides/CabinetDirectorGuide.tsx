import { Joyride, type Step, type EventData, type Controls, STATUS } from "react-joyride";
import { useGuide } from "@/contexts/GuideContext";
import { useEffect, useState } from "react";
const GUIDE_ID = "cabinet-director-intro";
const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Bienvenue, directeur",
    content: "Bienvenue ! Vous avez été invité(e) en tant que directeur au sein de ce cabinet.",
    showProgress: true,
  },
  {
    target: '[data-nav="/team"]',
    title: "Constituer votre équipe",
    content:
      "Depuis l'onglet Équipe, vous pouvez ajouter vos propres courtiers, ou même d'autres directeurs si besoin.",
    showProgress: true,
  },
  {
    target: "body",
    placement: "center",
    title: "Ce que vous voyez",
    content:
      "Vous avez une vision complète sur les courtiers que vous ajoutez vous-même. En revanche, les directeurs que vous ajoutez ne sont visibles que par le directeur principal du cabinet, pas par vous.",
    showProgress: true,
  },
];
export function CabinetDirectorGuide() {
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
export { GUIDE_ID as CABINET_DIRECTOR_GUIDE_ID, steps as cabinetDirectorSteps };