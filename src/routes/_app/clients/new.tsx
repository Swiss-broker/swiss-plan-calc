import { createFileRoute } from "@tanstack/react-router";
import { ClientWizard } from "@/components/clients/ClientWizard";

export const Route = createFileRoute("/_app/clients/new")({
  head: () => ({ meta: [{ title: "Nouveau client · SwissBroker Pro" }] }),
  component: NewClientPage,
});

function NewClientPage() {
  return <ClientWizard mode="create" />;
}
