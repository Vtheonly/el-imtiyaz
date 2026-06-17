/**
 * Sidebar — primary navigation.
 */

import { NavLink } from 'react-router-dom';
import {
  BarChart3, Users, DollarSign, AlertCircle, GraduationCap,
  Calendar, FileText, Receipt, Database, BookOpen, Settings,
  ChevronLeft, ChevronRight, User, Workflow, Bell, Award, Layers
} from 'lucide-react';
import { useState } from 'react';
import { DynamicLogo } from '../logo/DynamicLogo';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { path: '/students', label: 'Students', icon: Users },
      { path: '/payments', label: 'Payments', icon: DollarSign },
      { path: '/debt', label: 'Debt Dashboard', icon: AlertCircle },
      { path: '/notifications', label: 'Notifications', icon: Bell }
    ]
  },
  {
    title: 'School',
    items: [
      { path: '/classes', label: 'Classes', icon: GraduationCap },
      { path: '/parents', label: 'Parents', icon: Users },
      { path: '/employees', label: 'Employees', icon: User },
      { path: '/attendance', label: 'Attendance', icon: Calendar },
      { path: '/academic-years', label: 'Academic Years', icon: BookOpen }
    ]
  },
  {
    title: 'Financial',
    items: [
      { path: '/fee-templates', label: 'Fee Templates', icon: Layers },
      { path: '/scholarships', label: 'Scholarships', icon: Award }
    ]
  },
  {
    title: 'Automation',
    items: [
      { path: '/workflows', label: 'Workflows', icon: Workflow }
    ]
  },
  {
    title: 'Insights',
    items: [
      { path: '/reports', label: 'Reports', icon: FileText },
      { path: '/receipts', label: 'Receipts', icon: Receipt },
      { path: '/audit', label: 'Audit Logs', icon: Database },
      { path: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const [logoMode] = useState<'logo' | 'circular' | 'linear'>('logo');

  return (
    <aside
      className="el-sidebar"
      style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
    >
      <div className="el-sidebar__brand">
        <div style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36, overflow: 'hidden' }}>
          <DynamicLogo
            mode={logoMode}
            height={collapsed ? 32 : 36}
            allowUpload={false}
            showControls={false}
          />
        </div>
        {!collapsed && (
          <div>
            <div style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-tight)',
              lineHeight: 1.1
            }}>
              El-Imtiyaz
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              letterSpacing: 'var(--tracking-wide)'
            }}>
              School System
            </div>
          </div>
        )}
      </div>

      <nav className="el-sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="el-nav-section-title">{section.title}</div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `el-nav-item ${isActive ? 'el-nav-item--active' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? 'var(--space-3)' : undefined
                  }}
                >
                  <Icon className="el-nav-item__icon" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: 'var(--space-3)',
          borderTop: '1px solid var(--border-default)',
          flexShrink: 0
        }}
      >
        <button
          className="el-btn el-btn--ghost el-btn--sm"
          onClick={onToggleCollapse}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
