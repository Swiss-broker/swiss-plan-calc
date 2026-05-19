import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Link2,
  Copy,
  Trash2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Upload,
  Mail,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES,
  CATEGORY_LABELS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  sanitizeFilename,
  formatBytes,
  type DocumentCategory,
} from "@/lib/documents/categories";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type DocRow = {
  id: string;
  client_id: string;
  category: DocumentCategory;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: "broker" | "client_link";
  created_at: string;
};

type LinkRow = {
  id: string;
  token: string;
  expires_at: string;
  revoked: boolean;
  max_uploads: number;
  upload_count: number;
  created_at: string;
  last_used_at: string | null;
};

function randomToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function DocumentsTab({
  clientId,
  clientFirstName,
}: {
  clientId: string;
  clientFirstName: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [maxUploads, setMaxUploads] = useState(30);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("attestation_lpp");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewMime, setPreviewMime] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc">("date_desc");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const docsQuery = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DocRow[];
    },
  });

  const linksQuery = useQuery({
    queryKey: ["client-upload-links", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_document_links")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LinkRow[];
    },
  });

  const activeLink = linksQuery.data?.find(
    (l) => !l.revoked && new Date(l.expires_at) > new Date() && l.upload_count < l.max_uploads,
  );

  const createLink = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Auth required");
      const token = randomToken();
      const expires_at = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
      const { error } = await supabase.from("client_document_links").insert({
        client_id: clientId,
        broker_id: user.id,
        token,
        expires_at,
        max_uploads: maxUploads,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-upload-links", clientId] });
      setLinkDialogOpen(false);
      toast.success("Lien créé. Partagez-le avec votre client.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("client_document_links")
        .update({ revoked: true })
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-upload-links", clientId] });
      toast.success("Lien révoqué.");
    },
  });

  const deleteDoc = useMutation({
    mutationFn: async (doc: DocRow) => {
      const { error: storErr } = await supabase.storage
        .from("client-documents")
        .remove([doc.storage_path]);
      if (storErr) throw storErr;
      const { error } = await supabase.from("client_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast.success("Document supprimé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAsBroker = useMutation({
    mutationFn: async (files: FileList) => {
      if (!user) throw new Error("Auth required");
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name} : trop volumineux (max 20 MB)`);
          continue;
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
          toast.error(`${file.name} : type non autorisé`);
          continue;
        }
        const safeName = sanitizeFilename(file.name);
        const path = `${user.id}/${clientId}/${uploadCategory}/${crypto.randomUUID()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("client_documents").insert({
          client_id: clientId,
          broker_id: user.id,
          category: uploadCategory,
          original_filename: safeName,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: "broker",
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast.success("Document(s) ajouté(s).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPreview = async (doc: DocRow) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.storage_path, 600);
    if (error || !data) {
      toast.error("Impossible d'ouvrir le document.");
      return;
    }
    setPreviewUrl(data.signedUrl);
    setPreviewName(doc.original_filename);
    setPreviewMime(doc.mime_type);
  };

  const downloadDoc = async (doc: DocRow) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.storage_path, 600, { download: doc.original_filename });
    if (error || !data) {
      toast.error("Impossible de télécharger.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const linkUrl = activeLink
    ? `${window.location.origin}/client-upload/${activeLink.token}`
    : null;

  const docsByCategory: Record<string, DocRow[]> = {};
  for (const d of docsQuery.data || []) {
    (docsByCategory[d.category] ||= []).push(d);
  }

  const totalDocs = docsQuery.data?.length || 0;
  const totalCats = Object.keys(docsByCategory).length;

  return (
    <div className="space-y-6">
      {/* Lien client */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Link2 className="h-5 w-5 text-primary" />
              Lien de dépôt pour le client
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Générez un lien sécurisé et envoyez-le à {clientFirstName} pour qu'il dépose ses documents directement dans son dossier.
            </p>
          </div>
          <Button onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Générer un lien
          </Button>
        </div>

        {linksQuery.isLoading && <Loader2 className="mt-4 h-4 w-4 animate-spin" />}

        {activeLink && linkUrl && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="h-4 w-4" />
              Lien actif
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={linkUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(linkUrl);
                  toast.success("Lien copié.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = `Bonjour ${clientFirstName}, voici le lien pour déposer vos documents : ${linkUrl}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const subject = "Dépôt de vos documents";
                  const body = `Bonjour ${clientFirstName},\n\nVoici le lien pour déposer vos documents en toute sécurité :\n${linkUrl}\n\nCordialement.`;
                  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
              >
                <Mail className="mr-2 h-4 w-4" /> E-mail
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Expire le {new Date(activeLink.expires_at).toLocaleDateString("fr-CH")}
              </span>
              <span>·</span>
              <span>
                {activeLink.upload_count} / {activeLink.max_uploads} fichiers reçus
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-destructive hover:text-destructive"
                onClick={() => revokeLink.mutate(activeLink.id)}
              >
                Révoquer
              </Button>
            </div>
          </div>
        )}

        {!activeLink && !linksQuery.isLoading && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            Aucun lien actif. Cliquez sur « Générer un lien » pour en créer un.
          </div>
        )}
      </Card>

      {/* Upload direct par le courtier */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold">Ajouter un document directement</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous pouvez aussi déposer vous-même un document reçu par e-mail ou scan.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as DocumentCategory)}>
            <SelectTrigger className="sm:w-72">
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
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Upload className="h-4 w-4" />
            {uploadAsBroker.isPending ? "Envoi…" : "Choisir un fichier"}
            <input
              type="file"
              multiple
              className="sr-only"
              accept={ALLOWED_MIME_TYPES.join(",")}
              disabled={uploadAsBroker.isPending}
              onChange={(e) => {
                if (e.target.files) {
                  uploadAsBroker.mutate(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </Card>

      {/* Liste */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Documents au dossier</h3>
          <Badge variant="secondary">
            {totalDocs} document(s) · {totalCats} catégorie(s)
          </Badge>
        </div>

        {docsQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

        {!docsQuery.isLoading && totalDocs === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Aucun document pour ce client.
          </div>
        )}

        {totalDocs > 0 && (
          <Accordion type="multiple" defaultValue={Object.keys(docsByCategory)} className="w-full">
            {DOCUMENT_CATEGORIES.map((cat) => {
              const docs = docsByCategory[cat.value];
              if (!docs || docs.length === 0) return null;
              return (
                <AccordionItem key={cat.value} value={cat.value}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      {cat.label}
                      <Badge variant="outline" className="ml-2 h-5">
                        {docs.length}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {docs.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background p-3"
                        >
                          {fileIcon(doc.mime_type)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {doc.original_filename}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatBytes(doc.size_bytes)}</span>
                              <span>·</span>
                              <span>{new Date(doc.created_at).toLocaleString("fr-CH")}</span>
                              <Badge
                                variant={doc.uploaded_by === "client_link" ? "default" : "secondary"}
                                className="ml-1 h-4 text-[10px]"
                              >
                                {doc.uploaded_by === "client_link" ? "Client" : "Courtier"}
                              </Badge>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => openPreview(doc)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Supprimer "${doc.original_filename}" ?`)) {
                                deleteDoc.mutate(doc);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </Card>

      {/* Dialog: générer un lien */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un lien de dépôt</DialogTitle>
            <DialogDescription>
              Le client pourra déposer ses documents sans créer de compte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Durée de validité</Label>
              <Select
                value={String(expiresInDays)}
                onValueChange={(v) => setExpiresInDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="14">14 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre maximum de fichiers</Label>
              <Select value={String(maxUploads)} onValueChange={(v) => setMaxUploads(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 fichiers</SelectItem>
                  <SelectItem value="30">30 fichiers</SelectItem>
                  <SelectItem value="50">50 fichiers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeLink && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                Un lien actif existe déjà. En créer un nouveau ne désactive pas l'ancien.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => createLink.mutate()} disabled={createLink.isPending}>
              {createLink.isPending ? "Création…" : "Créer le lien"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="h-[70vh] w-full rounded-md border" title={previewName} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// CATEGORY_LABELS used externally if needed
export { CATEGORY_LABELS };
