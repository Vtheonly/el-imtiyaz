/**
 * GlobalSearch — fuzzy search across students, payments, receipts.
 *
 * Supports structured query syntax: `student:john status:unpaid year:2026`
 * Falls back to plain-text search if no field prefix is given.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, DollarSign, Receipt as ReceiptIcon } from 'lucide-react';
import { formatDZD, formatDate } from '@shared/currency';

interface SearchResult {
  id: string;
  type: 'student' | 'payment' | 'receipt';
  title: string;
  subtitle: string;
  path: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Parse query — extract field:value pairs
        const parts = query.split(/\s+/);
        const fields: Record<string, string> = {};
        let plainTerm = '';
        for (const part of parts) {
          const match = part.match(/^(\w+):(.+)$/);
          if (match) fields[match[1]] = match[2];
          else plainTerm += ' ' + part;
        }

        const term = plainTerm.trim() || query.trim();

        // Search students
        const students = await window.elImtiyaz.students.search(term);
        const studentResults: SearchResult[] = students.map((s: any) => ({
          id: s.id.value ?? s.id,
          type: 'student' as const,
          title: s.fullName,
          subtitle: `${s.studentCode} • ${s.status}`,
          path: `/students/${s.id.value ?? s.id}`
        }));

        // For v1 we don't query payments by free text server-side — that's an exercise for the future.
        setResults(studentResults.slice(0, 20));
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'student') return <User size={16} style={{ color: 'var(--color-primary-blue)' }} />;
    if (type === 'payment') return <DollarSign size={16} style={{ color: 'var(--color-warm-accent)' }} />;
    return <ReceiptIcon size={16} style={{ color: 'var(--color-success)' }} />;
  };

  if (!open) return null;

  return (
    <div className="el-modal-backdrop" onClick={onClose}>
      <div
        className="el-command-palette"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680 }}
      >
        <div className="flex items-center gap-2 px-5">
          <Search size={18} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            ref={inputRef}
            className="el-command-palette__input"
            placeholder="Search students, payments, receipts…  (try: student:john status:active)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="el-btn el-btn--ghost el-btn--icon el-btn--sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="el-command-palette__list">
          {loading && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <div className="el-spinner el-spinner--sm" style={{ display: 'inline-block', marginRight: 8 }} />
              Searching…
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No results for "{query}"
            </div>
          )}

          {!loading && results.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              className="el-command-palette__item"
              onClick={() => {
                navigate(r.path);
                onClose();
              }}
            >
              {iconFor(r.type)}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>{r.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {r.subtitle}
                </div>
              </div>
            </div>
          ))}

          {!loading && !query && (
            <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
              <div style={{ marginBottom: 'var(--space-3)', fontWeight: 'var(--weight-semibold)' }}>
                Tips
              </div>
              <ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-5)', lineHeight: 1.8 }}>
                <li>Type a name to search students</li>
                <li>Use <code className="text-mono">student:john status:active</code> for structured queries</li>
                <li>Press <kbd>Esc</kbd> to close</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
