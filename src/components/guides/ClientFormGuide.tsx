import { Joyride, type Step, type EventData, type Controls, STATUS } from "react-joyride";
import { useGuide } from "@/contexts/GuideContext";
import { useEffect, useState } from "react";

const GUIDE_ID = "client-form-intro";

const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Bienvenue sur la fiche client",
    content:
      "Plus vous renseignez d'informations ici, plus les calculateurs seront précis pour ce client. Une fiche complète permet des simulations fiscales et de prévoyance fiables.",
    showProgress: true,
  },
  {
    target: '[data-guide="client-identity"]',
    title: "Identité & situation",
    content: "Commencez par les informations de base : nom, canton, statut civil.",
    showProgress: true,
  },
  {
    target: '[data-guide="client-income"]',
    title: "Revenus",
    content:
      "Renseignez tous les revenus, y compris les revenus accessoires. Un revenu oublié peut fausser tous les calculs fiscaux.",
    showProgress: true,
  },
];

export function ClientFormGuide() {
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

export { GUIDE_ID as CLIENT_FORM_GUIDE_ID, steps as clientFormSteps };
