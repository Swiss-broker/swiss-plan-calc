import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channel = (supabase as any)
      .channel(`notifications-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `broker_id=eq.${user.id}` },
        () => loadNotifications()
      )
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await (supabase as any)
  .from("notifications")
  .select("id,type,title,body,link,read,created_at")
  .eq("broker_id", user.id)
  .order("created_at", { ascending: false })
  .limit(15);
setNotifications((data ?? []) as unknown as Notification[]);
  }

  async function markAsRead(id: string) {
    await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await (supabase as any).from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // "Relancer" depuis une notification de relance documentaire J+2 :
  // remet à zéro le délai de suivi (le job de relance ne renotifie qu'après
  // 2 nouveaux jours). N'envoie jamais d'e-mail au client : le courtier
  // garde la main sur le contact réel via la fiche client.
  async function relanceDocuments(n: Notification) {
    const clientId = n.link?.startsWith("/clients/") ? n.link.slice("/clients/".length) : null;
    if (clientId) {
      await (supabase as any)
        .from("client_document_requests")
        .update({ requested_at: new Date().toISOString(), reminder_sent_at: null })
        .eq("client_id", clientId)
        .in("status", ["demande", "a_remplacer"]);
    }
    await markAsRead(n.id);
  }

  return (
    <div className="relative" ref={ref} style={{ position: 'relative' }}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-4"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune notification
              </p>
            ) : (
              notifications.map((n) =>
                n.type === "appointment_followup" ? (
                  <div
                    key={n.id}
                    className={`border-b border-border/60 px-4 py-3 text-sm ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("fr-CH")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                          <Link
                            to={n.link || "/dashboard"}
                            onClick={() => { markAsRead(n.id); setOpen(false); }}
                            className="text-primary hover:underline"
                          >
                            Voir le suivi
                          </Link>
                          <button
                            type="button"
                            onClick={() => markAsRead(n.id)}
                            className="text-muted-foreground hover:underline"
                          >
                            Ignorer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : n.type === "documents_pending_j2" ? (
                  <div
                    key={n.id}
                    className={`border-b border-border/60 px-4 py-3 text-sm ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("fr-CH")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                          <Link
                            to={n.link || "/dashboard"}
                            onClick={() => { markAsRead(n.id); setOpen(false); }}
                            className="text-primary hover:underline"
                          >
                            Voir le dossier
                          </Link>
                          <button
                            type="button"
                            onClick={() => relanceDocuments(n)}
                            className="text-primary hover:underline"
                          >
                            Relancer
                          </button>
                          <button
                            type="button"
                            onClick={() => markAsRead(n.id)}
                            className="text-muted-foreground hover:underline"
                          >
                            Ignorer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={n.id}
                    to={n.link || "/dashboard"}
                    onClick={() => { markAsRead(n.id); setOpen(false); }}
                    className={`block border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-accent/50 ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("fr-CH")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}