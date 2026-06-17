/**
 * TopBar — global search, breadcrumb, action bar.
 */

import { useEffect, useState } from 'react';
import { Search, Command, Bell, Database } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenSearch: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/payments': 'Payments',
  '/debt': 'Debt Dashboard',
  '/classes': 'Classes',
  '/parents': 'Parents',
  '/employees': 'Employees',
  '/attendance': 'Attendance',
  '/academic-years': 'Academic Years',
  '/reports': 'Reports',
  '/receipts': 'Receipts',
  '/audit': 'Audit Logs',
  '/workflows': 'Workflows',
  '/notifications': 'Notifications',
  '/fee-templates': 'Fee Templates',
  '/scholarships': 'Scholarships',
  '/settings': 'Settings'
};

export function TopBar({ onOpenCommandPalette, onOpenSearch }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentLabel = ROUTE_LABELS[location.pathname] ?? 'El-Imtiyaz';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const count = await window.elImtiyaz.notifications.unreadCount();
        setUnreadCount(count as number);
      } catch {
        // ignore — not critical for topbar
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <header className="el-topbar drag-region">
      <div className="flex items-center gap-3 no-drag">
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-tertiary)',
          letterSpacing: 'var(--tracking-wide)'
        }}>
          El-Imtiyaz <span style={{ opacity: 0.4, margin: '0 6px' }}>/</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--weight-medium)' }}>
            {currentLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 no-drag">
        <button
          className="el-search-bar"
          onClick={onOpenSearch}
          style={{ width: 320, cursor: 'pointer', padding: '6px 12px' }}
        >
          <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            Search students, payments, receipts…
          </span>
          <span
            className="el-badge el-badge--neutral"
            style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px' }}
          >
            ⌘K
          </span>
        </button>

        <button
          className="el-btn el-btn--ghost el-btn--icon"
          onClick={onOpenCommandPalette}
          title="Command palette (⌘K)"
        >
          <Command size={16} />
        </button>

        <button
          className="el-btn el-btn--ghost el-btn--icon"
          onClick={() => window.elImtiyaz.system.backup()}
          title="Backup database"
        >
          <Database size={16} />
        </button>

        <button
          className="el-btn el-btn--ghost el-btn--icon"
          onClick={() => navigate('/notifications')}
          title="Notifications"
          style={{ position: 'relative' }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-danger)',
                color: 'white',
                fontSize: 9,
                fontWeight: 'var(--weight-bold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px var(--color-danger)'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
