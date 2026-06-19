import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GuideState {
  guidesSeen: string[];
  hasSeenGuide: (guideId: string) => boolean;
  markGuideSeen: (guideId: string) => Promise<void>;
  isLoading: boolean;
}

const GuideContext = createContext<GuideState | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [guidesSeen, setGuidesSeen] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("guides_seen")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setGuidesSeen(data?.guides_seen ?? []);
        setIsLoading(false);
      });
  }, [user, isAuthenticated]);

  const hasSeenGuide = (guideId: string) => guidesSeen.includes(guideId);

  const markGuideSeen = async (guideId: string) => {
    if (!user || guidesSeen.includes(guideId)) return;
    const updated = [...guidesSeen, guideId];
    setGuidesSeen(updated);
    await supabase.from("profiles").update({ guides_seen: updated }).eq("id", user.id);
  };

  return (
    <GuideContext.Provider value={{ guidesSeen, hasSeenGuide, markGuideSeen, isLoading }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide(): GuideState {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error("useGuide must be used within GuideProvider");
  return ctx;
}
