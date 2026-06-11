import { User } from "lucide-react";

interface Props {
  show: boolean;
  clientName?: string;
}

export function ClientPrefillBadge({ show, clientName }: Props) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      <User className="h-2.5 w-2.5" />
      {clientName ? clientName : "Depuis la fiche"}
    </span>
  );
}
