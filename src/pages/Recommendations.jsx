import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, Wand2 } from 'lucide-react';
import RecommendMessage from '@/components/recommend/RecommendMessage';

const SUGGESTED_PROMPTS = [
  'Recommend something based on my Watchlist',
  'What should I watch tonight?',
  'Suggest hidden gems similar to my taste',
  'Give me some feel-good picks',
];

export default function Recommendations() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  // Create a fresh conversation on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const conv = await base44.agents.createConversation({
        agent_name: 'media_recommender',
        metadata: { name: 'Recommendations', description: 'Personalized media suggestions' },
      });
      if (!active) return;
      setConversation(conv);
      setMessages(conv.messages || []);
      setInitializing(false);
    })();
    return () => { active = false; };
  }, []);

  // Subscribe to streamed updates.
  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      const last = data.messages?.[data.messages.length - 1];
      if (last?.role === 'assistant' && last.content) setSending(false);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text) => {
    const content = (text ?? input).trim();
    if (!content || !conversation || sending) return;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content }]);
    await base44.agents.addMessage(conversation, { role: 'user', content });
  }, [input, conversation, sending]);

  const hasConversation = messages.some(m => m.role === 'user');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground leading-tight">For You</h1>
            <p className="text-xs text-muted-foreground">Suggestions based on your Watchlist</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {initializing ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Starting…
          </div>
        ) : !hasConversation ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">Discover your next watch</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                I'll look at your Watchlist and viewing history to suggest movies and shows you'll love.
              </p>
            </div>
            <div className="grid gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left text-sm px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, idx) => <RecommendMessage key={idx} message={m} />)}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Thinking about your taste…
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-6 py-3 border-t border-border shrink-0 pb-safe-bottom">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for recommendations…"
            disabled={initializing || sending}
            className="flex-1 h-11 rounded-xl bg-secondary border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            disabled={initializing || sending || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}