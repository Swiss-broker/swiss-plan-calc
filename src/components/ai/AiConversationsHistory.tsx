import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ChevronDown, ChevronUp, Bot, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateShort } from "@/lib/i18n/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { WikiHelpLink } from "@/components/wiki/WikiHelpLink";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  client_id: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
  client?: { first_name: string; last_name: string } | null;
}

export function AiConversationsHistory() {
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["ai-conversations-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*, clients(first_name, last_name)")
        .eq("broker_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Conversation[];
    },
  });

  if (isLoading) return null;
  if (conversations.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Conversations IA ({conversations.length})
        </CardTitle>
        <WikiHelpLink article="ia-conversations-globales" />
      </CardHeader>
      <CardContent className="space-y-3">
        {conversations.map((conv) => {
          const msgs = Array.isArray(conv.messages) ? conv.messages as Message[] : [];
          const preview = msgs.find(m => m.role === "user")?.content ?? "Conversation vide";
          const isOpen = openId === conv.id;
          const clientName = conv.client
            ? `${conv.client.first_name} ${conv.client.last_name}`
            : null;

          return (
            <div key={conv.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : conv.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{preview.slice(0, 80)}{preview.length > 80 ? "..." : ""}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDateShort(conv.updated_at)}</span>
                      <span>·</span>
                      <span>{msgs.length} message{msgs.length > 1 ? "s" : ""}</span>
                      {clientName && conv.client_id && (
                        <>
                          <span>·</span>
                          <Link
                            to="/clients/$clientId"
                            params={{ clientId: conv.client_id }}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {clientName}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/10">
                  {msgs.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                        ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      </div>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm
                        ${msg.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted/60 text-foreground"}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
