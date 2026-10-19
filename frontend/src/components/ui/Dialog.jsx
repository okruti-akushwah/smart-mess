import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import Button from './Button';
import Icon from '../Icon';
import './dialog.css';

export default function Dialog({ open, title, onClose, busy = false, className = '', id, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const translate = useTranslation();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(<dialog id={id} ref={ref} className={`ui-dialog ${className}`.trim()} aria-modal="true" aria-labelledby={titleId} aria-busy={busy || undefined}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="ui-dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="outline" className="ui-dialog-close" disabled={busy} aria-label={translate('Close dialog')} onClick={onClose}><Icon name="close" /></Button></div>
    <div className="ui-dialog-content">{children}</div>
  </dialog>, document.body);
}
