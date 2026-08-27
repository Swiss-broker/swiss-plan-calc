import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileText, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_HELP,
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

// Le SDK Supabase expose l'erreur HTTP d'une Edge Function via
// `error.context`, un objet Response dont le corps JSON contient le code
// d'erreur métier (ex. {"error": "LINK_EXPIRED"}). Même pattern déjà
// utilisé ailleurs dans l'app (ex. src/routes/_app/team.tsx).
export async function extractErrorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // corps non exploitable, on retombe sur le message générique
    }
  }
  return null;
}

type QueuedFile = {
  id: string;
  file: File;
  category: DocumentCategory;
  error?: string;
};

function ClientUploadPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocumentCategory>("attestation_lpp");
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [sent, setSent] = useState<{ name: string; category: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase.functions
      .invoke("client-upload", { body: { token } })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          const code = data?.error ?? (await extractErrorCode(error)) ?? "INVALID_TOKEN";
          setLoadError(ERROR_MESSAGES[code] || "Lien invalide.");
          return;
        }
        setInfo(data as LinkInfo);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Impossible de joindre le serveur.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Les fichiers choisis (clic ou glisser-déposer) sont d'abord ajoutés à
  // une file d'attente, avec la catégorie par défaut du moment : rien n'est
  // envoyé tant que le client n'a pas cliqué sur "Envoyer". Ça permet aussi
  // de corriger la catégorie par fichier avant l'envoi (utile si le lot
  // contient des documents de types différents).
  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} : fichier trop volumineux (max 20 MB)`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, category });
    }
    if (accepted.length > 0) setQueue((q) => [...q, ...accepted]);
  };

  const removeFromQueue = (id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  };

  const updateQueuedCategory = (id: string, newCategory: DocumentCategory) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, category: newCategory } : item)));
  };

  const sendQueue = async () => {
    if (queue.length === 0) return;
    setUploading(true);
    let successCount = 0;
    const stillQueued: QueuedFile[] = [];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const form = new FormData();
      form.append("token", token);
      form.append("file", item.file);
      form.append("category", item.category);
      try {
        const { data, error } = await supabase.functions.invoke("client-upload", { body: form });
        if (error || data?.error) {
          const code = data?.error ?? (await extractErrorCode(error)) ?? "UPLOAD_FAILED";
          const message = ERROR_MESSAGES[code] || "échec";
          toast.error(`${item.file.name} : ${message}`);
          if (code === "LINK_QUOTA_REACHED" || code === "LINK_EXPIRED" || code === "LINK_REVOKED") {
            setLoadError(ERROR_MESSAGES[code]);
            // Lien devenu invalide : inutile d'essayer le reste de la file.
            stillQueued.push(...queue.slice(i));
            break;
          }
          stillQueued.push({ ...item, error: message });
        } else {
          successCount += 1;
          setSent((s) => [...s, { name: item.file.name, category: item.category }]);
        }
      } catch {
        toast.error(`${item.file.name} : erreur réseau`);
        stillQueued.push({ ...item, error: "Erreur réseau" });
      }
    }
    setQueue(stillQueued);
    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) envoyé(s) avec succès.`);
      // refresh quota
      void supabase.functions
        .invoke("client-upload", { body: { token } })
        .then(({ data }) => data && !data.error && setInfo(data as LinkInfo))
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
            <CardTitle>Bonjour {info.clientFirstName || ""} 👋</CardTitle>
            <CardDescription>
              Déposez ici les documents demandés par <strong>{info.brokerDisplay}</strong>. Vérifiez
              votre sélection puis cliquez sur "Envoyer" : vos fichiers arrivent alors directement
              dans votre dossier, en toute confidentialité.
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
            <CardDescription>
              Catégorie appliquée par défaut aux fichiers ajoutés. Modifiable individuellement avant
              l'envoi si vous déposez plusieurs types de documents.
            </CardDescription>
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
            {DOCUMENT_HELP[category] && (
              <p className="mt-3 text-xs text-muted-foreground">
                <strong>Où trouver ce document ?</strong> {DOCUMENT_HELP[category]}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Ajoutez vos fichiers</CardTitle>
            <CardDescription>
              PDF, JPG, PNG ou WEBP. {formatBytes(MAX_FILE_SIZE_BYTES)} max par fichier. Rien n'est
              envoyé tant que vous n'avez pas validé à l'étape suivante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition hover:bg-muted/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!uploading) addFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Cliquez pour sélectionner ou glissez-déposez
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Vous pouvez ajouter plusieurs fichiers à la fois.
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                accept={ALLOWED_MIME_TYPES.join(",")}
                disabled={uploading}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </CardContent>
        </Card>

        {queue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Vérifiez et envoyez</CardTitle>
              <CardDescription>
                Corrigez la catégorie si besoin, retirez ce qui ne doit pas partir, puis envoyez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 sm:flex-nowrap"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(item.file.size)}
                      </div>
                      {item.error && <div className="text-xs text-destructive">{item.error}</div>}
                    </div>
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateQueuedCategory(item.id, v as DocumentCategory)}
                      disabled={uploading}
                    >
                      <SelectTrigger className="w-full sm:w-[190px]">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={uploading}
                      onClick={() => removeFromQueue(item.id)}
                      aria-label={`Retirer ${item.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button className="w-full" disabled={uploading} onClick={() => void sendQueue()}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours…
                  </>
                ) : (
                  `Envoyer ${queue.length} fichier${queue.length > 1 ? "s" : ""}`
                )}
              </Button>
            </CardContent>
          </Card>
        )}

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
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent([])}>
                Effacer la liste
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
