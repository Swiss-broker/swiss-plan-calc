import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

export function ExportPdfButton({
  onClick,
  label = "Exporter le rapport PDF",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="default"
      className="shine gap-2 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
    >
      <FileDown className="h-4 w-4" />
      {label}
    </Button>
  );
}
