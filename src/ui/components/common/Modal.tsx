/**
 * Modal — accessible dialog component.
 */

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = { sm: 400, md: 540, lg: 720, xl: 960 }[size];

  return (
    <div className="el-modal-backdrop" onClick={onClose}>
      <div
        className="el-modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="el-modal__header">
            <div className="el-modal__title">{title}</div>
            <button className="el-btn el-btn--ghost el-btn--icon el-btn--sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="el-modal__body">{children}</div>
        {footer && <div className="el-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
