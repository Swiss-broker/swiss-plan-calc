import { useEffect, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import type { SimulationKind } from "@/lib/history/types";

export function SaveSimulationButton({
  kind,
  inputs,
  summary,
  defaultTitle,
}: {
  kind: SimulationKind;
  inputs: Record<string, unknown>;
  summary: Record<string, unknown>;
  defaultTitle?: string;
}) {
  const { user } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [tagsRaw, setTagsRaw] = useState("");

  // Pré-remplir depuis l'URL si on est lancé depuis une fiche client (?clientId=xxx)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("clientId");
    if (cid) setClientId(cid);
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("archived", false)
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("save_sim.error.unauth"));
      const tags = tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = {
        broker_id: user.id,
        client_id: clientId === "none" ? null : clientId,
        kind,
        title: title.trim() || (defaultTitle ?? t("save_sim.default_title")),
        note: note.trim() || null,
        inputs: inputs as never,
        summary: summary as never,
        tags,
      };
      const { error } = await supabase.from("simulation_history").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation-history"] });
      toast.success(t("save_sim.toast.success"));
      setOpen(false);
      setTitle(defaultTitle ?? "");
      setNote("");
      setTagsRaw("");
      setClientId("none");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shine gap-2">
          <Bookmark className="h-4 w-4" />
          {t("common.save")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("save_sim.title")}</DialogTitle>
          <DialogDescription>{t("save_sim.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("save_sim.field.title")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle ?? t("save_sim.placeholder.title")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("save_sim.field.note")}</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("save_sim.placeholder.note")}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("save_sim.field.client")}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("save_sim.client.none")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.last_name} {c.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("save_sim.field.tags")}
              </Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder={t("save_sim.placeholder.tags")}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
