/**
 * LoadingScreen — branded splash with dynamic particle logo.
 *
 * Shown during initial app bootstrap (database open, migrations, etc).
 * The logo runs in 'circular' mode for a satisfying loader effect.
 */

import { useEffect, useState } from 'react';
import { DynamicLogo } from '../components/logo/DynamicLogo';

interface LoadingScreenProps {
  onReady: () => void;
}

const BOOT_STAGES = [
  'Initialising runtime…',
  'Opening database…',
  'Applying migrations…',
  'Loading academic calendar…',
  'Registering services…',
  'Preparing workspace…'
];

export function LoadingScreen({ onReady }: LoadingScreenProps) {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stageIdx = 0;
    const interval = setInterval(() => {
      stageIdx = (stageIdx + 1) % BOOT_STAGES.length;
      setStage(stageIdx);
      setProgress((p) => Math.min(100, p + 100 / BOOT_STAGES.length));
      if (stageIdx === 0 && progress >= 95) {
        clearInterval(interval);
        setTimeout(onReady, 400);
      }
    }, 380);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, #2e3033 0%, var(--color-dark-bg) 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn var(--duration-slow) var(--ease-out)'
      }}
    >
      <div style={{ width: 280, height: 280, marginBottom: 'var(--space-6)' }}>
        <DynamicLogo mode="circular" height={280} allowUpload={false} showControls={false} />
      </div>

      <div style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--weight-bold)',
        letterSpacing: 'var(--tracking-tight)',
        marginBottom: 4
      }}>
        El-Imtiyaz
      </div>
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-tertiary)',
        letterSpacing: 'var(--tracking-wide)',
        marginBottom: 'var(--space-6)'
      }}>
        School System v1.0.0
      </div>

      <div style={{ width: 320, marginBottom: 'var(--space-4)' }}>
        <div className="el-progress">
          <div className="el-progress__fill brand-loading-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: 'var(--tracking-wide)',
        height: 16
      }}>
        {BOOT_STAGES[stage]}
      </div>
    </div>
  );
}
