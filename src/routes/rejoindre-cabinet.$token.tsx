// Route publique (hors layout _app) : un collaborateur invité rejoint un
// cabinet. Trois cas : nouvelle personne (création du compte), compte
// existant non connecté (connexion sur place), compte déjà connecté.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callCabinet } from "@/hooks/useCabinet";

export const Route = createFileRoute("/rejoindre-cabinet/$token")({
  head: () => ({ meta: [{ title: "Rejoindre un cabinet · SwissBroker Pro" }] }),
  component: JoinCabinetPage,
});

type Info = {
  cabinetName: string;
  email: string;
  firstName: string;
  lastName: string;
  payer: "cabinet" | "self";
  accountExists: boolean;
};

function JoinCabinetPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    callCabinet<Info>("info", { token })
      .then((d) => {
        setInfo(d);
        setFirstName(d.firstName);
        setLastName(d.lastName);
      })
      .catch((e) => setError((e as Error).message));
  }, [token]);

  const finish = async () => {
    await callCabinet("accept", { token });
    toast.success(`Bienvenue dans le cabinet ${info?.cabinetName ?? ""}`);
    navigate({ to: "/dashboard" });
  };

  const onJoinLoggedIn = async () => {
    setBusy(true);
    try {
      await finish();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const onSignInAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: info.email, password });
    if (signInError) {
      toast.error("Mot de passe incorrect.");
      setBusy(false);
      return;
    }
    try {
      await finish();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  const onSignUpAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (password.length < 8) return toast.error("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return toast.error("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      await callCabinet("signup_accept", { token, password, first_name: firstName.trim(), last_name: lastName.trim() });
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: info.email, password });
      if (signInError) {
        toast.success("Compte créé. Connectez-vous avec votre adresse e-mail et votre mot de passe.");
        navigate({ to: "/auth" });
        return;
      }
      toast.success(`Bienvenue dans le cabinet ${info.cabinetName}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  const signedInAs = user?.email?.toLowerCase() ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        {error ? (
          <CardContent className="space-y-3 pt-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <p className="text-sm">{error}</p>
          </CardContent>
        ) : !info || authLoading ? (
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Rejoindre {info.cabinetName}</CardTitle>
              <CardDescription>
                Invitation pour <strong>{info.email}</strong>.{" "}
                {info.payer === "cabinet"
                  ? "Votre cotisation annuelle est prise en charge par le cabinet."
                  : "Votre cotisation annuelle reste à votre charge."}{" "}
                Vos rendez-vous sont encaissés sur le compte du cabinet : aucun compte bancaire à fournir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signedInAs && signedInAs !== info.email.toLowerCase() ? (
                <div className="space-y-3 text-sm">
                  <p>
                    Vous êtes connecté avec <strong>{user?.email}</strong>. Cette invitation est destinée à{" "}
                    <strong>{info.email}</strong>.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
                    Me déconnecter
                  </Button>
                </div>
              ) : signedInAs ? (
                <Button className="w-full gap-2" disabled={busy} onClick={onJoinLoggedIn}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Rejoindre le cabinet
                </Button>
              ) : info.accountExists ? (
                <form onSubmit={onSignInAndJoin} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Vous avez déjà un compte : connectez-vous pour rejoindre le cabinet. Vos clients actuels restent les vôtres.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="join_pw">Mot de passe</Label>
                    <Input id="join_pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Me connecter et rejoindre
                  </Button>
                </form>
              ) : (
                <form onSubmit={onSignUpAndJoin} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="join_first">Prénom</Label>
                      <Input id="join_first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="join_last">Nom</Label>
                      <Input id="join_last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="join_new_pw">Mot de passe (8 caractères minimum)</Label>
                    <Input id="join_new_pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="join_confirm">Confirmer le mot de passe</Label>
                    <Input id="join_confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Créer mon compte et rejoindre
                  </Button>
                </form>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
