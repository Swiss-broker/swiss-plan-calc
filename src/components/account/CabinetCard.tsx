// Onglet « Mon cabinet » du profil : créer son cabinet (devenir patron),
// accéder à la gestion de l'équipe, ou voir le cabinet dont on fait partie.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCabinet, callCabinet } from "@/hooks/useCabinet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CabinetCard({ defaultName }: { defaultName: string }) {
  const cabinet = useCabinet();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const qc = useQueryClient();

  if (cabinet.isLoading) return null;

  const onLeave = async () => {
    setSaving(true);
    try {
      await callCabinet("leave");
      await cabinet.refresh();
      qc.invalidateQueries();
      toast.success("Vous avez quitté le cabinet. Vous pouvez désormais travailler en indépendant ou créer votre cabinet.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  if (cabinet.role === "collaborateur") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Vous faites partie du cabinet {cabinet.cabinetName}
        </div>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>Les rendez-vous que vous facturez sont encaissés sur le compte du cabinet : aucun compte bancaire à fournir.</li>
          <li>
            Cotisation annuelle :{" "}
            {cabinet.payer === "cabinet" ? "prise en charge par le cabinet." : "à votre charge (onglet Abonnement)."}
          </li>
          <li>Les rapports PDF portent le nom du cabinet.</li>
        </ul>
        <Button variant="ghost" size="sm" className="mt-3 text-destructive" disabled={saving} onClick={() => setConfirmLeave(true)}>
          Quitter le cabinet
        </Button>
        <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitter le cabinet {cabinet.cabinetName} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Les clients que vous suivez appartiennent au cabinet : ils restent chez {cabinet.cabinetName}, avec leurs
                dossiers, documents et rendez-vous, et disparaissent de votre compte. Vos rendez-vous ne seront plus
                encaissés sur le compte du cabinet : pour facturer à nouveau, vous devrez connecter votre propre compte
                bancaire.
                {cabinet.payer === "cabinet"
                  ? " Votre cotisation n'est plus prise en charge par le cabinet : vous devrez la régler vous-même pour garder l'accès."
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Quitter le cabinet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (cabinet.role === "patron") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            {cabinet.cabinetName}
          </div>
          <p className="mt-1 text-muted-foreground">Vous êtes responsable de ce cabinet.</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/cabinet">
            <Users className="h-4 w-4" />
            Gérer mon équipe
          </Link>
        </Button>
      </div>
    );
  }

  const onCreate = async () => {
    setSaving(true);
    try {
      await callCabinet("create", { name: name.trim(), address: address.trim() });
      await cabinet.refresh();
      toast.success("Cabinet créé");
      navigate({ to: "/cabinet" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold">Vous travaillez en équipe ?</h2>
        <p className="text-xs text-muted-foreground">
          Créez votre cabinet pour inviter vos collaborateurs. Leurs rendez-vous sont encaissés sur votre compte
          bancaire, vous voyez leurs dossiers et leurs paiements, et vous choisissez pour chacun qui paie la cotisation.
        </p>
      </div>
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
          <Building2 className="h-4 w-4" />
          Créer mon cabinet
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cabinet_name">Nom du cabinet</Label>
            <Input id="cabinet_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Piliarys Sàrl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cabinet_address">Adresse (facultatif)</Label>
            <Input id="cabinet_address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue, NPA, localité" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onCreate} disabled={saving || name.trim().length < 2} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le cabinet
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
