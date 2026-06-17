/**
 * ContextualAutocomplete — semantic (graph-aware) autocomplete.
 *
 * Not just text completion: based on the current context (selected student,
 * active class, etc.), it suggests related entities that make sense.
 *
 * Example:
 *   - Selecting a student suggests their unpaid invoices & parents
 *   - Selecting a class suggests available payment plans
 *   - Selecting a workflow node suggests valid next nodes
 *
 * The suggestion provider is a function that receives the current context
 * and returns suggestions. Callers plug in their domain logic.
 */

import { useEffect, useRef, useState, ReactNode } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

export interface Suggestion {
  id: string;
  label: string;
  description?: string;
  category?: string;
  icon?: ReactNode;
  /** Carry arbitrary context for the onSelect handler. */
  payload?: unknown;
}

export interface SuggestionContext {
  type: 'student' | 'class' | 'payment' | 'workflow' | 'general';
  entityId?: string;
  filters?: Record<string, unknown>;
}

interface ContextualAutocompleteProps {
  context: SuggestionContext;
  placeholder?: string;
  /** Returns suggestions based on the current query + context. */
  provider: (query: string, context: SuggestionContext) => Promise<Suggestion[]>;
  onSelect: (suggestion: Suggestion) => void;
  initialValue?: string;
  className?: string;
}

export function ContextualAutocomplete({
  context,
  placeholder = 'Type to search…',
  provider,
  onSelect,
  initialValue = '',
  className
}: ContextualAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await provider(query, context);
        setSuggestions(result.slice(0, 20));
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, context, provider]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[selectedIdx]) {
      e.preventDefault();
      handleSelect(suggestions[selectedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (s: Suggestion) => {
    onSelect(s);
    setQuery(s.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  // Group by category
  const grouped = suggestions.reduce((acc, s) => {
    const cat = s.category ?? 'Suggestions';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Suggestion[]>);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <div
        className="el-input"
        style={{
          width: '100%',
          cursor: 'text',
          borderColor: open ? 'var(--color-primary-blue)' : undefined,
          boxShadow: open ? '0 0 0 3px rgba(52,155,212,0.12)' : undefined
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: 0, color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
          >
            <X size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        )}
      </div>

      {open && (query.trim() || suggestions.length > 0) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 'var(--z-dropdown)',
            maxHeight: 320,
            overflowY: 'auto',
            animation: 'scaleIn var(--duration-fast) var(--ease-spring)'
          }}
        >
          {loading && (
            <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <div className="el-spinner el-spinner--sm" style={{ display: 'inline-block', marginRight: 8 }} />
              Searching…
            </div>
          )}

          {!loading && suggestions.length === 0 && query.trim() && (
            <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No matches for "{query}"
            </div>
          )}

          {!loading && Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div
                style={{
                  padding: '4px 12px',
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-wider)',
                  color: 'var(--color-text-muted)',
                  fontWeight: 'var(--weight-semibold)',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                {cat}
              </div>
              {items.map((s) => {
                const idx = suggestions.indexOf(s);
                const isSelected = idx === selectedIdx;
                return (
                  <div
                    key={s.id}
                    onMouseDown={() => handleSelect(s)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-primary-tint-15)' : undefined,
                      borderRadius: 'var(--radius-sm)',
                      margin: '2px 4px'
                    }}
                  >
                    {s.icon && <span style={{ color: 'var(--color-primary-blue)' }}>{s.icon}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{s.label}</div>
                      {s.description && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{s.description}</div>
                      )}
                    </div>
                    {isSelected && <ChevronRight size={14} style={{ color: 'var(--color-primary-blue)' }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
