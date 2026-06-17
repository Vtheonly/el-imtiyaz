/**
 * DynamicLogo — React wrapper around the ParticleEngine.
 *
 * Three modes:
 *   - 'logo'      → interactive logo (default)
 *   - 'circular'  → spinning loader
 *   - 'linear'    → progress bar loader
 *
 * Usage:
 *   <DynamicLogo mode="logo" height={500} />
 *   <DynamicLogo mode="circular" height={120} />
 *
 * The component is self-contained — it renders the demo pattern if no image
 * is supplied, and supports drag-and-drop image upload.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ParticleEngine, LogoMode } from './particle-engine';

interface DynamicLogoProps {
  mode?: LogoMode;
  height?: number;
  imageUrl?: string;
  /** Show the file-upload overlay when no imageUrl is supplied. */
  allowUpload?: boolean;
  /** Show the controls panel (mode switch + sliders). */
  showControls?: boolean;
  className?: string;
}

export function DynamicLogo({
  mode = 'logo',
  height = 500,
  imageUrl,
  allowUpload = true,
  showControls = false,
  className
}: DynamicLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const [currentMode, setCurrentMode] = useState<LogoMode>(mode);
  const [interactionRadius, setInteractionRadius] = useState(100);
  const [pushForce, setPushForce] = useState(6);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new ParticleEngine({
      canvas: canvasRef.current,
      mode: currentMode,
      interactionRadius,
      pushForce,
      imageUrl,
      onReady: () => setReady(true)
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // React to mode changes
  useEffect(() => {
    engineRef.current?.setMode(currentMode);
  }, [currentMode]);

  // React to slider changes
  useEffect(() => {
    engineRef.current?.setInteractionRadius(interactionRadius);
  }, [interactionRadius]);

  useEffect(() => {
    engineRef.current?.setPushForce(pushForce);
  }, [pushForce]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        // Recreate engine with new image
        engineRef.current?.destroy();
        const engine = new ParticleEngine({
          canvas: canvasRef.current,
          mode: currentMode,
          interactionRadius,
          pushForce,
          imageElement: img,
          onReady: () => setReady(true)
        });
        engineRef.current = engine;
        engine.start();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [currentMode, interactionRadius, pushForce]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  return (
    <div className={`dynamic-logo ${className ?? ''}`} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'block',
          borderRadius: 'var(--radius-lg)',
          background: 'radial-gradient(circle at center, #2e3033 0%, var(--color-dark-bg) 100%)'
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      />

      {!ready && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)'
        }}>
          <div className="el-spinner" style={{ marginRight: 'var(--space-3)' }} />
          Initialising logo…
        </div>
      )}

      {allowUpload && ready && (
        <label
          style={{
            position: 'absolute',
            bottom: 'var(--space-3)',
            right: 'var(--space-3)',
            padding: '6px 10px',
            background: 'rgba(30, 31, 32, 0.85)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-warm-accent)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)'
          }}
        >
          Change image
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
      )}

      {showControls && (
        <div
          className="el-card"
          style={{
            marginTop: 'var(--space-3)',
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div className="flex gap-2">
            {(['logo', 'circular', 'linear'] as LogoMode[]).map((m) => (
              <button
                key={m}
                className={`el-btn el-btn--sm ${currentMode === m ? 'el-btn--primary' : 'el-btn--ghost'}`}
                onClick={() => setCurrentMode(m)}
              >
                {m === 'logo' ? 'Interactive' : m === 'circular' ? 'Circular' : 'Progress'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>Radius</span>
            <input
              type="range"
              min="40"
              max="200"
              value={interactionRadius}
              onChange={(e) => setInteractionRadius(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </label>

          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>Force</span>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={pushForce}
              onChange={(e) => setPushForce(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
