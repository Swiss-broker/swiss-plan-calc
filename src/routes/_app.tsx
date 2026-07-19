import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AiChat } from "@/components/ai/AiChat";
import { CompleteProfileModal } from "@/components/CompleteProfileModal";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calculator,
  UserCircle,
  LogOut,
  Loader2,
  Building2,
  Menu,
  Bookmark,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { useT } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/auth" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar onSignOut={signOut} email={user?.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader onSignOut={signOut} email={user?.email ?? ""} />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
          <AiChat />
          <CompleteProfileModal />
        </main>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <FeedbackWidget />
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/clients", labelKey: "nav.clients", icon: Users },
  { to: "/companies", labelKey: "nav.companies", icon: Building2 },
  { to: "/calculators", labelKey: "nav.calculators", icon: Calculator },
  { to: "/wiki", labelKey: "nav.wiki", icon: BookOpen },
  { to: "/history", labelKey: "nav.history", icon: Bookmark },
  { to: "/feedback", labelKey: "nav.feedback", icon: MessageSquare },
  { to: "/account", labelKey: "nav.account", icon: UserCircle },
] as const;

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
        <span className="text-sm font-bold text-primary-foreground">S</span>
      </div>
      <div className="text-sm font-semibold tracking-tight">
        SwissBroker <span className="text-primary">Pro</span>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV.map((item) => {
        const active =
          pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            search={item.to === "/calculators" ? { clientId: undefined } : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-gradient-to-r from-primary/15 to-primary/5 text-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_40%,transparent),0_4px_12px_-4px_color-mix(in_oklab,var(--primary)_25%,transparent)] ring-1 ring-primary/20"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5",
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const t = useT();
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate text-muted-foreground">{email}</span>
      </div>
      <LanguageSwitcher />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start gap-2 text-sidebar-foreground/70"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4" />
        {t("nav.signout")}
      </Button>
    </div>
  );
}

function DesktopSidebar({ onSignOut, email }: { onSignOut: () => Promise<void>; email: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border/60 bg-sidebar/70 backdrop-blur-xl lg:flex lg:flex-col shadow-[inset_-1px_0_0_0_color-mix(in_oklab,white_30%,transparent)]">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <BrandMark />
        <NotificationBell />
      </div>
      <NavLinks />
      <UserFooter email={email} onSignOut={onSignOut} />
    </aside>
  );
}

function MobileHeader({ onSignOut, email }: { onSignOut: () => Promise<void>; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl saturate-150 lg:hidden">
      <BrandMark />
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border px-5 py-4 text-left">
            <SheetTitle>
              <BrandMark />
            </SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
          <UserFooter email={email} onSignOut={onSignOut} />
        </SheetContent>
      </Sheet>
      </div>
    </header>
  );
}
