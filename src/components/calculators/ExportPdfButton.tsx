import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export function ExportPdfButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) {
  const t = useT();
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="default"
      className="shine gap-2 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
    >
      <FileDown className="h-4 w-4" />
      {label ?? t("common.export_pdf_report")}
    </Button>
  );
}
