// Suivi de statut par catégorie ("DOCUMENTS À FOURNIR"), construit par-dessus
// le système de documents existant (client_documents / client_document_links)
// sans le modifier. Une ligne client_document_requests par catégorie ; en son
// absence, le statut affiché est "Manquant" (aucune écriture nécessaire tant
// que rien n'a été demandé).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Loader2 } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES, DOCUMENT_HELP, type DocumentCategory } from "@/lib/documents/categories";
import { EmailComposerDialog } from "@/components/clients/EmailComposerDialog";
import type { TemplateKey } from "@/lib/emails/templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type RequestStatus = "manquant" | "demande" | "recu" | "verifie" | "a_remplacer";

type RequestRow = {
  id: string;
  category: DocumentCategory;
  status: "demande" | "recu" | "verifie" | "a_remplacer";
  note: string | null;
  requested_at: string;
  received_at: string | null;
  verified_at: string | null;
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  manquant: "Manquant",
  demande: "Demandé",
  recu: "Reçu",
  verifie: "Vérifié",
  a_remplacer: "À remplacer",
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  manquant: "bg-muted text-muted-foreground",
  demande: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  recu: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  verifie: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  a_remplacer: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DocumentRequestsPanel({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [replaceTarget, setReplaceTarget] = useState<RequestRow | null>(null);
  const [replaceNote, setReplaceNote] = useState("");
  // Documents cochés par le courtier pour la prochaine demande/relance
  // groupée : un seul e-mail listant uniquement ces documents-là, pas tous
  // les documents encore en attente pour le client.
  const [selected, setSelected] = useState<Set<DocumentCategory>>(new Set());
  // "Envoyer la demande" n'écrit qu'en base : sans ouvrir ensuite le
  // composeur d'e-mail, le client ne reçoit jamais rien et le courtier
  // croit à tort que la demande a été notifiée.
  const [emailTemplate, setEmailTemplate] = useState<TemplateKey | null>(null);
  const [emailCategories, setEmailCategories] = useState<DocumentCategory[]>([]);

  const toggleSelected = (cat: DocumentCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const requestsQuery = useQuery({
    queryKey: ["client-document-requests", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_document_requests")
        .select("id,category,status,note,requested_at,received_at,verified_at")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []) as RequestRow[];
    },
  });

  const byCategory = new Map<DocumentCategory, RequestRow>();
  for (const r of requestsQuery.data || []) byCategory.set(r.category, r);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-document-requests", clientId] });

  // Une seule action pour la sélection cochée : crée une demande pour les
  // documents encore "manquant", relance ceux déjà "demandé"/"à remplacer",
  // puis ouvre un e-mail unique listant uniquement ces documents-là.
  const sendSelected = useMutation({
    mutationFn: async (categories: DocumentCategory[]) => {
      if (!user) throw new Error("Auth required");
      for (const category of categories) {
        const row = byCategory.get(category);
        if (!row) {
          const { error } = await supabase.from("client_document_requests").insert({
            client_id: clientId,
            broker_id: user.id,
            category,
            status: "demande",
            requested_at: new Date().toISOString(),
          });
          if (error) throw error;
        } else if (row.status === "demande" || row.status === "a_remplacer") {
          const { error } = await supabase
            .from("client_document_requests")
            .update({ requested_at: new Date().toISOString(), reminder_sent_at: null })
            .eq("id", row.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, categories) => {
      invalidate();
      const isPureRelance = categories.every((cat) => {
        const row = byCategory.get(cat);
        return row && (row.status === "demande" || row.status === "a_remplacer");
      });
      toast.success(categories.length > 1 ? `${categories.length} documents demandés.` : "Document demandé.");
      setSelected(new Set());
      setEmailCategories(categories);
      setEmailTemplate(isPureRelance ? "relance_j2" : "demande_documents");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifier = useMutation({
    mutationFn: async (row: RequestRow) => {
      const { error } = await supabase
        .from("client_document_requests")
        .update({ status: "verifie", verified_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Document marqué comme vérifié.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aRemplacer = useMutation({
    mutationFn: async ({ row, note }: { row: RequestRow; note: string }) => {
      const { error } = await supabase
        .from("client_document_requests")
        .update({
          status: "a_remplacer",
          note: note.trim() || null,
          verified_at: null,
          requested_at: new Date().toISOString(),
          reminder_sent_at: null,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setReplaceTarget(null);
      setReplaceNote("");
      toast.success("Document marqué « à remplacer ».");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <div>
        <h3 className="text-lg font-semibold">Documents à fournir</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi de ce qui a été demandé au client, reçu et vérifié, par-dessus les documents du dossier.
        </p>
      </div>

      {requestsQuery.isLoading ? (
        <Loader2 className="mt-4 h-4 w-4 animate-spin" />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} document${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`
                : "Cochez les documents à demander ou relancer, puis envoyez un e-mail groupé."}
            </p>
            <Button
              size="sm"
              disabled={selected.size === 0 || sendSelected.isPending}
              onClick={() => sendSelected.mutate(Array.from(selected))}
            >
              {sendSelected.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer la demande"}
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Demandé</TableHead>
                <TableHead className="hidden md:table-cell">Reçu</TableHead>
                <TableHead className="hidden md:table-cell">Vérifié</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DOCUMENT_CATEGORIES.map((cat) => {
                const row = byCategory.get(cat.value);
                const status: RequestStatus = row?.status ?? "manquant";
                const help = DOCUMENT_HELP[cat.value];
                return (
                  <TableRow key={cat.value}>
                    <TableCell className="max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{cat.label}</span>
                        {help && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label="Où trouver ce document ?"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="text-sm">
                              <p className="font-medium">Où trouver ce document ?</p>
                              <p className="mt-1 text-muted-foreground">{help}</p>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      {row?.note && status === "a_remplacer" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">« {row.note} »</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {row ? fmtDate(row.requested_at) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {fmtDate(row?.received_at ?? null)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {fmtDate(row?.verified_at ?? null)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(status === "manquant" || status === "demande" || status === "a_remplacer") && (
                        <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                          {status === "manquant" ? "À demander" : "À relancer"}
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${cat.label}`}
                            checked={selected.has(cat.value)}
                            onChange={() => toggleSelected(cat.value)}
                            className="h-4 w-4 rounded border-input"
                          />
                        </label>
                      )}
                      {status === "recu" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={verifier.isPending}
                            onClick={() => row && verifier.mutate(row)}
                          >
                            Vérifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => row && setReplaceTarget(row)}
                          >
                            À remplacer
                          </Button>
                        </div>
                      )}
                      {status === "verifie" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => row && setReplaceTarget(row)}
                        >
                          À remplacer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </>
      )}

      <Dialog open={!!replaceTarget} onOpenChange={(o) => !o && setReplaceTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer « à remplacer »</DialogTitle>
            <DialogDescription>
              {replaceTarget && (
                <>Le document « {DOCUMENT_CATEGORIES.find((c) => c.value === replaceTarget.category)?.label} » sera signalé comme incorrect ou incomplet, et une nouvelle demande sera relancée.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={replaceNote}
            onChange={(e) => setReplaceNote(e.target.value)}
            placeholder="Précisez pourquoi (optionnel), ex. document illisible, mauvaise année, page manquante..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceTarget(null)}>
              Annuler
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={aRemplacer.isPending}
              onClick={() => replaceTarget && aRemplacer.mutate({ row: replaceTarget, note: replaceNote })}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emailTemplate && (
        // key força un remount à chaque changement de modèle ou de
        // sélection : le composeur ne relit defaultTemplateKey/categoriesOverride
        // qu'au montage (useState), donc sans ça, une 2e demande consécutive
        // avec le même modèle rouvrirait sur la liste de documents précédente.
        <EmailComposerDialog
          key={`${emailTemplate}-${emailCategories.join(",")}`}
          clientId={clientId}
          open
          onOpenChange={(o) => !o && setEmailTemplate(null)}
          defaultTemplateKey={emailTemplate}
          categoriesOverride={emailCategories}
          onSent={() => setEmailTemplate(null)}
        />
      )}
    </Card>
  );
}
