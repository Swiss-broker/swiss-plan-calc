// Filet de sécurité de dernier recours pour les erreurs de rendu qui
// surviennent HORS de l'arbre de routage (context providers dans
// __root.tsx : AuthProvider, PlanProvider, etc.). Les erreurs DANS une
// route sont déjà gérées par defaultErrorComponent (router.tsx), qui les
// attrape avant qu'elles n'atteignent ce composant — normal de ne jamais
// voir cet écran en pratique, c'est le filet sous le filet.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { logClientError } from "@/lib/error-logging";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logClientError(error.message, error.stack, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold text-foreground">Une erreur est survenue</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              L'équipe SwissBroker Pro a été notifiée. Vous pouvez essayer de recharger la page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
