import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

function parseResults(results) {
  if (results == null) return null;
  if (typeof results === 'object') return results;
  try { return JSON.parse(results); } catch { return results; }
}

function ToolCall({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const proj = toolCall.display_projection || {};
  const parsed = parseResults(toolCall.results);

  const failed =
    ['failed', 'error'].includes(toolCall.status) ||
    /error|failed/i.test(typeof toolCall.results === 'string' ? toolCall.results : '') ||
    (parsed && parsed.success === false);
  const running = ['pending', 'running', 'in_progress'].includes(toolCall.status);

  const label = failed
    ? (proj.error_label || 'Something went wrong')
    : running
      ? (proj.active_label || 'Working…')
      : (proj.label || toolCall.name?.replace(/_/g, ' '));

  const hideDetails = proj.hide_details && proj.details_redacted;

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => !hideDetails && setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {running ? <Loader2 className="w-3 h-3 animate-spin" />
          : failed ? <AlertCircle className="w-3 h-3 text-destructive" />
          : <CheckCircle2 className="w-3 h-3 text-green-400" />}
        <span className="capitalize">{label}</span>
        {!hideDetails && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1.5 space-y-2 rounded-lg bg-secondary/50 p-2 font-mono text-[11px] text-muted-foreground overflow-x-auto">
          {toolCall.arguments_string && (
            <div>
              <p className="text-foreground/70 mb-0.5">Parameters:</p>
              <pre className="whitespace-pre-wrap break-all">{(() => {
                try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); }
                catch { return toolCall.arguments_string; }
              })()}</pre>
            </div>
          )}
          {parsed != null && (
            <div>
              <p className="text-foreground/70 mb-0.5">Result:</p>
              <pre className="whitespace-pre-wrap break-all">{typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecommendMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-card border border-border text-foreground rounded-bl-sm'
      }`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recommendations</span>
          </div>
        )}
        {message.content && (
          isUser
            ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            : <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-1.5 prose-li:my-0.5">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, idx) => <ToolCall key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}