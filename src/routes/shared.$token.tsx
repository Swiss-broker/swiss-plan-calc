import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Lock,
  Loader2,
  ShieldCheck,
  Calendar,
  Eye,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  KIND_LABELS,
  type SimulationKind,
} from "@/lib/history/types";
import { extractKpis, regeneratePdf } from "@/lib/history/registry";
import { formatCHF } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export const Route = createFileRoute("/shared/$token")({
  head: () => ({
    meta: [{ title: "Simulation partagée · SwissBroker Pro" }],
  }),
  component: SharedSimulationPage,
});

type SharedData = {
  kind: SimulationKind;
  title: string;
  note: string | null;
  inputs: Record<string, unknown>;
  summary: Record<string, unknown>;
  tags: string[];
  simulation_created_at: string;
  shared_at: string;
  expires_at: string | null;
  remaining_views: number | null;
  broker_display: string | null;
};

const ERROR_LABELS: Record<string, string> = {
  SHARE_NOT_FOUND: "Ce lien n'existe pas ou a été supprimé.",
  SHARE_REVOKED: "Ce lien a été révoqué par son auteur.",
  SHARE_EXPIRED: "Ce lien a expiré.",
  SHARE_MAX_VIEWS: "Le nombre maximum de consultations a été atteint.",
  SHARE_PASSWORD_REQUIRED: "Ce lien est protégé par un mot de passe.",
  SHARE_PASSWORD_INVALID: "Mot de passe incorrect.",
};

function decodeError(msg: string | undefined): string {
  if (!msg) return "Accès refusé.";
  for (const key of Object.keys(ERROR_LABELS)) {
    if (msg.includes(key)) return ERROR_LABELS[key];
  }
  return msg;
}

function SharedSimulationPage() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [data, setData] = useState<SharedData | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const fetchShare = useMutation({
    mutationFn: async (pw: string | null) => {
      const { data: rows, error } = await supabase.rpc(
        "access_shared_simulation",
        { _token: token, _password: pw },
      );
      if (error) throw error;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error("SHARE_NOT_FOUND");
      return row as SharedData;
    },
    onSuccess: (row) => {
      setData(row);
      setErrorMsg(null);
      setNeedsPassword(false);
    },
    onError: (err: Error) => {
      const m = err.message || "";
      setAttempted(true);
      if (m.includes("SHARE_PASSWORD_REQUIRED")) {
        setNeedsPassword(true);
        setErrorMsg(null);
      } else if (m.includes("SHARE_PASSWORD_INVALID")) {
        setNeedsPassword(true);
        setErrorMsg(decodeError(m));
      } else {
        setErrorMsg(decodeError(m));
      }
    },
  });

  // Initial load
  if (!attempted && !fetchShare.isPending) {
    fetchShare.mutate(null);
  }

  const handlePdf = async () => {
    if (!data) return;
    try {
      await regeneratePdf(data.kind, data.inputs, data.broker_display ?? undefined);
      toast.success("PDF généré");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Password gate
  if (!data && needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Lien protégé
            </CardTitle>
            <CardDescription>
              Cette simulation est protégée. Saisissez le mot de passe pour la
              consulter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Mot de passe</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password) fetchShare.mutate(password);
                }}
                autoFocus
              />
            </div>
            {errorMsg && (
              <div className="text-sm text-destructive">{errorMsg}</div>
            )}
            <Button
              className="w-full bg-gradient-primary text-primary-foreground"
              onClick={() => fetchShare.mutate(password)}
              disabled={!password || fetchShare.isPending}
            >
              {fetchShare.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Accéder"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (!data && errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Accès refusé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = extractKpis(data.kind, data.summary);

  const formatVal = (v: number | string, unit?: string | null) => {
    if (typeof v === "string") return v;
    if (unit === "CHF") return formatCHF(v);
    if (unit === "%") return `${v.toFixed(2)} %`;
    return v.toLocaleString("fr-CH");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">SwissBroker Pro · Lien partagé</span>
          </div>
          <Button onClick={handlePdf} variant="outline" size="sm" className="gap-1.5">
            <FileDown className="h-4 w-4" /> Télécharger le PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{KIND_LABELS[data.kind]}</Badge>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Partagé le {new Date(data.shared_at).toLocaleDateString("fr-CH")}
          </span>
          {data.expires_at && (
            <span>
              · expire le {new Date(data.expires_at).toLocaleDateString("fr-CH")}
            </span>
          )}
          {data.remaining_views !== null && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {data.remaining_views} vue
              {data.remaining_views > 1 ? "s" : ""} restante
              {data.remaining_views > 1 ? "s" : ""}
            </span>
          )}
          {data.broker_display && <span>· par {data.broker_display}</span>}
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{data.title}</CardTitle>
            {data.note && <CardDescription>{data.note}</CardDescription>}
            {data.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {kpis.map((k) => (
                  <TableRow key={k.label}>
                    <TableCell className="text-muted-foreground">
                      {k.label}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatVal(k.value, k.unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Lien sécurisé · les données sont régénérées à partir des paramètres
          sauvegardés. Calculs basés sur la fiscalité suisse 2026.
        </p>
      </main>
    </div>
  );
}
