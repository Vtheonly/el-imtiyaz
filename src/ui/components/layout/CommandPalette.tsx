/**
 * CommandPalette — Cmd+K global action launcher.
 *
 * Fuzzy-matches commands by name & keywords. Supports keyboard navigation
 * (arrow keys, enter, escape). Designed to be the "everything launcher" —
 * navigation, common actions, recent items.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import {
  Search, ArrowRight, CornerDownLeft, Command, User, DollarSign,
  FileText, BarChart3, Users, Calendar, Settings, Receipt,
  GraduationCap, BookOpen, AlertCircle, Database, FolderDown,
  Workflow, Bell, Award, Layers
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  group: string;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    return [
      { id: 'nav-dashboard', label: 'Dashboard', icon: <BarChart3 size={16} />, action: go('/dashboard'), group: 'Navigation' },
      { id: 'nav-students', label: 'Students', icon: <Users size={16} />, action: go('/students'), group: 'Navigation' },
      { id: 'nav-payments', label: 'Payments', icon: <DollarSign size={16} />, action: go('/payments'), group: 'Navigation' },
      { id: 'nav-debt', label: 'Debt Dashboard', icon: <AlertCircle size={16} />, action: go('/debt'), group: 'Navigation' },
      { id: 'nav-classes', label: 'Classes', icon: <GraduationCap size={16} />, action: go('/classes'), group: 'Navigation' },
      { id: 'nav-parents', label: 'Parents', icon: <Users size={16} />, action: go('/parents'), group: 'Navigation' },
      { id: 'nav-employees', label: 'Employees', icon: <User size={16} />, action: go('/employees'), group: 'Navigation' },
      { id: 'nav-attendance', label: 'Attendance', icon: <Calendar size={16} />, action: go('/attendance'), group: 'Navigation' },
      { id: 'nav-reports', label: 'Reports', icon: <FileText size={16} />, action: go('/reports'), group: 'Navigation' },
      { id: 'nav-receipts', label: 'Receipts', icon: <Receipt size={16} />, action: go('/receipts'), group: 'Navigation' },
      { id: 'nav-audit', label: 'Audit Logs', icon: <Database size={16} />, action: go('/audit'), group: 'Navigation' },
      { id: 'nav-academic-years', label: 'Academic Years', icon: <BookOpen size={16} />, action: go('/academic-years'), group: 'Navigation' },
      { id: 'nav-workflows', label: 'Workflows', icon: <Workflow size={16} />, action: go('/workflows'), group: 'Navigation' },
      { id: 'nav-notifications', label: 'Notifications', icon: <Bell size={16} />, action: go('/notifications'), group: 'Navigation' },
      { id: 'nav-fee-templates', label: 'Fee Templates', icon: <Layers size={16} />, action: go('/fee-templates'), group: 'Navigation' },
      { id: 'nav-scholarships', label: 'Scholarships', icon: <Award size={16} />, action: go('/scholarships'), group: 'Navigation' },
      { id: 'nav-settings', label: 'Settings', icon: <Settings size={16} />, action: go('/settings'), group: 'Navigation' },

      {
        id: 'act-new-student',
        label: 'New Student',
        icon: <User size={16} />,
        shortcut: ['⌘', 'N'],
        action: () => { navigate('/students?action=new'); onClose(); },
        group: 'Actions'
      },
      {
        id: 'act-new-payment',
        label: 'Record Payment',
        icon: <DollarSign size={16} />,
        shortcut: ['⌘', '⇧', 'P'],
        action: () => { navigate('/payments?action=new'); onClose(); },
        group: 'Actions'
      },
      {
        id: 'act-export',
        label: 'Export Current View',
        icon: <FolderDown size={16} />,
        shortcut: ['⌘', 'E'],
        action: () => { window.dispatchEvent(new CustomEvent('el:export-current')); onClose(); },
        group: 'Actions'
      },
      {
        id: 'act-backup',
        label: 'Backup Database',
        icon: <Database size={16} />,
        action: async () => {
          await window.elImtiyaz.system.backup();
          onClose();
        },
        group: 'System'
      }
    ];
  }, [navigate, onClose]);

  const fuse = useMemo(() => new Fuse(commands, {
    keys: ['label', 'keywords', 'group'],
    threshold: 0.4,
    ignoreLocation: true
  }), [commands]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return fuse.search(query).map((r) => r.item);
  }, [query, commands, fuse]);

  // Group results
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.group) ?? [];
      arr.push(cmd);
      map.set(cmd.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Flatten for keyboard navigation
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flat[selectedIdx]?.action();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, flat, selectedIdx, onClose]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="el-modal-backdrop" onClick={onClose}>
      <div
        className="el-command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5">
          <Search size={18} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            ref={inputRef}
            className="el-command-palette__input"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <span className="el-badge el-badge--neutral">
            <Command size={10} /> K
          </span>
        </div>

        <div className="el-command-palette__list">
          {grouped.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No commands match "{query}"
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="el-nav-section-title" style={{ padding: 'var(--space-2) var(--space-4)' }}>
                {group}
              </div>
              {items.map((cmd) => {
                runningIdx++;
                const isSelected = runningIdx === selectedIdx;
                return (
                  <div
                    key={cmd.id}
                    className={`el-command-palette__item ${isSelected ? 'el-command-palette__item--selected' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIdx(runningIdx)}
                  >
                    <span className="el-command-palette__item__icon">{cmd.icon}</span>
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className="el-command-palette__item__shortcut">
                        {cmd.shortcut.join(' ')}
                      </span>
                    )}
                    {isSelected && <ArrowRight size={14} style={{ marginLeft: 'var(--space-2)' }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderTop: '1px solid var(--border-default)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'center'
          }}
        >
          <span className="flex items-center gap-1">
            <CornerDownLeft size={12} /> Select
          </span>
          <span className="flex items-center gap-1">↑↓ Navigate</span>
          <span className="flex items-center gap-1">Esc Close</span>
        </div>
      </div>
    </div>
  );
}
