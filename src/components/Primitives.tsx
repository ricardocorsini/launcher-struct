import { useEffect, useId, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { Product } from '../types';
import { iconPath } from '../domain';

export function ProductIcon({ app, large = false }: { app: Product; large?: boolean }) {
  return (
    <div
      className={`product-icon ${large ? 'large' : ''}`}
      style={{ '--product': app.color } as CSSProperties}
    >
      <img src={iconPath(app)} alt="" />
    </div>
  );
}
export function External({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button className={`external-link ${className}`} onClick={onClick}>
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </button>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
export function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="icon-button close-dialog" aria-label={label} onClick={onClick}>
      <X size={20} aria-hidden="true" />
    </button>
  );
}
export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
