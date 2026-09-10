// src/components/common/DemoModeBadge.tsx
// Badge fixe indiquant qu'un compte est en mode démo (plan='demo', voir
// TÂCHE 1) — jamais un compte de production. Monté une seule fois dans
// AppShell (_app.tsx), donc visible sur absolument toutes les pages
// authentifiées, desktop comme mobile, peu importe la route.
export function DemoModeBadge() {
  return (
    <div
      className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-elegant"
      role="status"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
      Mode démo
    </div>
  );
}
