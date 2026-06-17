/**
 * Settings — school configuration, backup/restore, appearance.
 */

import { useState } from 'react';
import { Settings as SettingsIcon, Database, Save, Palette, FileDown } from 'lucide-react';
import { Card, Button, Badge } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { PALETTE } from '@shared/constants';

export function Settings() {
  const [schoolName, setSchoolName] = useState('El-Imtiyaz Private School');
  const [schoolAddress, setSchoolAddress] = useState('Algiers, Algeria');
  const [schoolPhone, setSchoolPhone] = useState('+213 00 00 00 00');
  const [schoolEmail, setSchoolEmail] = useState('contact@el-imtiyaz.dz');
  const [currency, setCurrency] = useState('DZD');

  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await window.elImtiyaz.system.backup();
      setBackupResult((result as any).path);
    } catch (err) {
      setBackupResult(`Backup failed: ${(err as Error).message}`);
    } finally {
      setBacking(false);
    }
  };

  return (
    <div className="el-page">
      <PageHeader title="Settings" subtitle="School configuration & system tools" />

      <div className="flex flex-col gap-4">
        {/* School Identity */}
        <Card title="School Identity" subtitle="Used on receipts, reports, and exports">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>School Name</label>
              <input className="el-input" style={{ width: '100%' }} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Phone</label>
              <input className="el-input" style={{ width: '100%' }} value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Address</label>
              <input className="el-input" style={{ width: '100%' }} value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
              <input className="el-input" style={{ width: '100%' }} value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Currency</label>
              <div className="el-select" style={{ width: '100%' }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: '100%' }}>
                  <option value="DZD">DZD — Algerian Dinar</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end" style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="primary" icon={<Save size={14} />}>Save Changes</Button>
          </div>
        </Card>

        {/* Brand Palette */}
        <Card title="Brand Palette" subtitle="El-Imtiyaz Academic Brand">
          <div className="flex flex-wrap gap-3">
            {Object.entries(PALETTE).filter(([k]) => !k.includes('RGB') && !k.includes('TINT')).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  background: value as string,
                  border: '1px solid var(--border-default)',
                  boxShadow: `0 0 12px ${value}33`
                }} />
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>{key}</div>
                  <div className="text-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System Tools */}
        <Card title="System Tools" subtitle="Backup & maintenance">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Database Backup</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                  Creates a timestamped snapshot of the SQLite database.
                </div>
              </div>
              <Button
                variant="primary"
                icon={<Database size={14} />}
                onClick={handleBackup}
                disabled={backing}
              >
                {backing ? 'Backing up…' : 'Backup Now'}
              </Button>
            </div>

            {backupResult && (
              <div className="el-card" style={{ background: 'var(--color-primary-tint-08)', padding: 'var(--space-3)' }}>
                <div className="flex items-center gap-2">
                  <FileDown size={14} style={{ color: 'var(--color-primary-blue)' }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Backup saved to:</span>
                  <code className="text-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-blue)' }}>
                    {backupResult}
                  </code>
                </div>
              </div>
            )}

            <div className="el-divider" />

            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Application Logs</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                  Open the logs folder to inspect rolling log files.
                </div>
              </div>
              <Badge tone="neutral">Available via Help menu</Badge>
            </div>

            <div className="el-divider" />

            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>System Info</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                  Version, platform, and runtime details.
                </div>
              </div>
              <Button variant="ghost" onClick={async () => {
                const info = await window.elImtiyaz.system.info();
                alert(JSON.stringify(info, null, 2));
              }}>
                Show Info
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
