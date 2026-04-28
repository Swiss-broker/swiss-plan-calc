import { useState } from "react";
import { Share2, Copy, Loader2, Trash2, EyeOff } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase as _supabase } from "@/integrations/supabase/client";
// Table not yet in generated types · use a loose alias.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from "@/contexts/AuthContext";

type ShareRow = {
  id: string;
  token: string;
  password_hash: string | null;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  revoked: boolean;
  last_viewed_at: string | null;
  created_at: string;
};

function generateToken(): string {
  // 24-byte URL-safe random
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function ShareSimulationButton({
  simulationId,
  variant = "ghost",
  size = "sm",
  showLabel = false,
}: {
  simulationId: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [useExpiry, setUseExpiry] = useState(true);
  const [expiryDays, setExpiryDays] = useState(30);
  const [useMaxViews, setUseMaxViews] = useState(false);
  const [maxViews, setMaxViews] = useState(10);

  const { data: existing = [] } = useQuery({
    queryKey: ["sim-shares", simulationId],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_shares")
        .select("*")
        .eq("simulation_id", simulationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ShareRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      const token = generateToken();
      const expires_at =
        useExpiry && expiryDays > 0
          ? new Date(Date.now() + expiryDays * 86400_000).toISOString()
          : null;
      const max_views = useMaxViews && maxViews > 0 ? maxViews : null;

      const { data: inserted, error } = await supabase
        .from("simulation_shares")
        .insert({
          broker_id: user.id,
          simulation_id: simulationId,
          token,
          expires_at,
          max_views,
        })
        .select("id, token")
        .single();
      if (error) throw error;
      const row = inserted as unknown as { id: string; token: string };

      if (usePassword && password.trim().length > 0) {
        const { data: hash, error: hashErr } = await supabase.rpc(
          "hash_share_password",
          { _share_id: row.id, _password: password },
        );
        if (hashErr) throw hashErr;
        const { error: updErr } = await supabase
          .from("simulation_shares")
          .update({ password_hash: hash as unknown as string })
          .eq("id", row.id);
        if (updErr) throw updErr;
      }
      return row.token;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/shared/${token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Lien créé et copié dans le presse-papiers");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["sim-shares", simulationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("simulation_shares")
        .update({ revoked: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lien révoqué");
      qc.invalidateQueries({ queryKey: ["sim-shares", simulationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("simulation_shares")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lien supprimé");
      qc.invalidateQueries({ queryKey: ["sim-shares", simulationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié"),
      () => toast.error("Impossible de copier"),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} title="Partager" className="shine">
          <Share2 className="h-4 w-4" />
          {showLabel && <span className="ml-1.5">Partager</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Partager la simulation
          </DialogTitle>
          <DialogDescription>
            Générez un lien sécurisé pour partager cette simulation. Vous pouvez
            définir un mot de passe, une date d'expiration et un nombre maximum
            de consultations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-pw" className="text-sm">
                Protéger par mot de passe
              </Label>
              <Switch
                id="use-pw"
                checked={usePassword}
                onCheckedChange={setUsePassword}
              />
            </div>
            {usePassword && (
              <Input
                type="text"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="use-exp" className="text-sm">
                Date d'expiration
              </Label>
              <Switch
                id="use-exp"
                checked={useExpiry}
                onCheckedChange={setUseExpiry}
              />
            </div>
            {useExpiry && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">jours</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="use-views" className="text-sm">
                Limiter le nombre de consultations
              </Label>
              <Switch
                id="use-views"
                checked={useMaxViews}
                onCheckedChange={setUseMaxViews}
              />
            </div>
            {useMaxViews && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxViews}
                  onChange={(e) => setMaxViews(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">vues max</span>
              </div>
            )}
          </div>

          {existing.length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Liens existants ({existing.length})
              </div>
              <ul className="space-y-2">
                {existing.map((s) => {
                  const url = `${window.location.origin}/shared/${s.token}`;
                  const expired =
                    s.expires_at && new Date(s.expires_at) < new Date();
                  const exhausted =
                    s.max_views !== null && s.view_count >= s.max_views;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono">{url}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {s.password_hash && (
                            <Badge variant="outline" className="text-[10px]">
                              🔒 mot de passe
                            </Badge>
                          )}
                          {s.expires_at && (
                            <Badge
                              variant={expired ? "destructive" : "outline"}
                              className="text-[10px]"
                            >
                              exp: {new Date(s.expires_at).toLocaleDateString("fr-CH")}
                            </Badge>
                          )}
                          <Badge
                            variant={exhausted ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {s.view_count}
                            {s.max_views ? ` / ${s.max_views}` : ""} vues
                          </Badge>
                          {s.revoked && (
                            <Badge variant="destructive" className="text-[10px]">
                              révoqué
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(s.token)}
                          title="Copier"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {!s.revoked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revoke.mutate(s.id)}
                            title="Révoquer"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(s.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || (usePassword && !password.trim())}
            className="gap-2 bg-gradient-primary text-primary-foreground"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Générer un lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
