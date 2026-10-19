import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import Button from './Button';
import Icon from '../Icon';
import './drawer.css';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Drawer({ open, title, onClose, busy = false, className = '', id, children, desktopPopover = false, anchorRef = null }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1100px)').matches);
  const [anchorPosition, setAnchorPosition] = useState(null);
  const drawerRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();
  const translate = useTranslation();
  const popover = desktopPopover && desktop;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(min-width: 1100px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open || !popover || !anchorRef?.current) return;
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setAnchorPosition({ top: Math.max(8, rect.bottom + 8), right: Math.max(8, window.innerWidth - rect.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, popover, anchorRef]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => { setMounted(true); setClosing(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!mounted) return;
    const start = window.setTimeout(() => setClosing(true), 0);
    const finish = window.setTimeout(() => setMounted(false), 180);
    return () => { window.clearTimeout(start); window.clearTimeout(finish); };
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = previousFocus;
    if (!popover) document.body.style.overflow = 'hidden';
    if (popover) drawerRef.current?.focus();
    else drawerRef.current?.querySelector('button')?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
      if (popover || event.key !== 'Tab' || closing) return;
      const controls = [...drawerRef.current.querySelectorAll(focusable)].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); drawerRef.current.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (!popover) document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [mounted, closing, busy, onClose, popover]);

  if (!mounted) return null;
  const inlineStyle = popover && anchorPosition ? { top: `${anchorPosition.top}px`, right: `${anchorPosition.right}px` } : undefined;
  return createPortal(<div className={`ui-drawer-layer${closing ? ' is-closing' : ''}${popover ? ' is-popover' : ''}`}>
    <button className="ui-drawer-backdrop" type="button" tabIndex="-1" aria-label={translate('Close dialog')} disabled={busy} onClick={onClose} />
    <aside id={id} ref={drawerRef} style={inlineStyle} className={`ui-drawer ${className}`.trim()} role="dialog" aria-modal={popover ? undefined : 'true'} aria-labelledby={titleId} aria-busy={busy || undefined} tabIndex="-1">
      <div className="ui-drawer-heading"><h2 id={titleId}>{title}</h2><Button variant="outline" className="ui-drawer-close" disabled={busy} aria-label={translate('Close dialog')} onClick={onClose}><Icon name="close" /></Button></div>
      <div className="ui-drawer-content">{children}</div>
    </aside>
  </div>, document.body);
}
