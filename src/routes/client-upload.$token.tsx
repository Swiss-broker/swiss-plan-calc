import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  formatBytes,
  type DocumentCategory,
} from "@/lib/documents/categories";

export const Route = createFileRoute("/client-upload/$token")({
  head: () => ({ meta: [{ title: "Dépôt de documents · SwissBroker Pro" }] }),
  component: ClientUploadPage,
});

type LinkInfo = {
  clientFirstName: string | null;
  brokerDisplay: string | null;
  expiresAt: string;
  uploadsRemaining: number;
};

const ERROR_MESSAGES: Record<string, string> = {
  LINK_NOT_FOUND: "Ce lien n'existe pas ou a été supprimé.",
  LINK_EXPIRED: "Ce lien a expiré. Demandez-en un nouveau à votre courtier.",
  LINK_REVOKED: "Ce lien a été révoqué.",
  LINK_QUOTA_REACHED: "Le nombre maximum de fichiers pour ce lien est atteint.",
  INVALID_TOKEN: "Lien invalide.",
  FILE_TOO_LARGE: "Fichier trop volumineux (max 20 MB).",
  INVALID_TYPE: "Type de fichier non autorisé (PDF, JPG, PNG, WEBP uniquement).",
  INVALID_CATEGORY: "Catégorie invalide.",
  FILE_REQUIRED: "Aucun fichier sélectionné.",
  EMPTY_FILE: "Fichier vide.",
  RATE_LIMITED: "Trop de fichiers envoyés. Patientez une minute.",
  UPLOAD_FAILED: "Échec de l'envoi. Réessayez.",
};

function ClientUploadPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocumentCategory>("attestation_lpp");
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState<{ name: string; category: string }[]>([]);

  useEffect(() => {
    void fetch(`/api/public/client-upload/${token}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setLoadError(ERROR_MESSAGES[body?.error] || "Lien invalide.");
        else setInfo(body);
      })
      .catch(() => setLoadError("Impossible de joindre le serveur."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} : fichier trop volumineux (max 20 MB)`);
        continue;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      try {
        const r = await fetch(`/api/public/client-upload/${token}`, {
          method: "POST",
          body: form,
        });
        const body = await r.json();
        if (!r.ok) {
          toast.error(`${file.name} : ${ERROR_MESSAGES[body?.error] || "échec"}`);
          if (body?.error === "LINK_QUOTA_REACHED" || body?.error === "LINK_EXPIRED" || body?.error === "LINK_REVOKED") {
            setLoadError(ERROR_MESSAGES[body.error]);
            break;
          }
        } else {
          successCount += 1;
          setSent((s) => [...s, { name: file.name, category }]);
        }
      } catch {
        toast.error(`${file.name} : erreur réseau`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) envoyé(s) avec succès.`);
      // refresh quota
      void fetch(`/api/public/client-upload/${token}`)
        .then((r) => r.ok && r.json())
        .then((body) => body && setInfo(body))
        .catch(() => undefined);
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Lien indisponible</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{loadError || "Lien invalide."}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Contactez votre courtier pour obtenir un nouveau lien.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Bonjour {info.clientFirstName || ""} 👋
            </CardTitle>
            <CardDescription>
              Déposez ici les documents demandés par <strong>{info.brokerDisplay}</strong>.
              Vos fichiers arrivent directement dans votre dossier, en toute confidentialité.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div>Lien valable jusqu'au {new Date(info.expiresAt).toLocaleDateString("fr-CH")}.</div>
            <div>{info.uploadsRemaining} fichier(s) restant(s).</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Choisissez le type de document</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="sr-only">Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Déposez votre fichier</CardTitle>
            <CardDescription>
              PDF, JPG, PNG ou WEBP. {formatBytes(MAX_FILE_SIZE_BYTES)} max par fichier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition hover:bg-muted/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!uploading) void handleFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Cliquez pour sélectionner ou glissez-déposez
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Vous pouvez envoyer plusieurs fichiers à la fois.
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                accept={ALLOWED_MIME_TYPES.join(",")}
                disabled={uploading}
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </label>
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
              </div>
            )}
          </CardContent>
        </Card>

        {sent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fichiers envoyés</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {sent.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSent([])}
              >
                Effacer la liste
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
