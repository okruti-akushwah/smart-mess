import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import ChatPanel from '../pages/Messages';
import Icon from './Icon';
import api from '../services/api';
import './chat-widget.css';

export default function ChatWidget() {
  const { pathname } = useLocation();
  const role = localStorage.getItem('role');
  const mess = localStorage.getItem('activeMessToken');
  const token = localStorage.getItem('token');
  const enabled = token && ((role === 'owner' && pathname.startsWith('/owner') && !['/owner/login', '/owner/register'].includes(pathname))
    || (role === 'customer' && mess && pathname.startsWith('/customer') && pathname !== '/customer/messes'));
  return enabled ? <FloatingChat key={`${role}:${mess}:${token}`} owner={role === 'owner'} /> : null;
}

function FloatingChat({ owner }) {
  const translate = useTranslation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const button = useRef(null), closeButton = useRef(null);
  useEffect(() => {
    let active = true, fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const { data } = await api.get('/chat/conversations');
        if (active) setUnread(data.reduce((total, row) => total + row.unread, 0));
      } catch { /* Opening the chat displays connection errors. */ }
      finally { fetching = false; }
    }
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener('chat-updated', load);
    window.addEventListener('focus', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('chat-updated', load); window.removeEventListener('focus', load); };
  }, []);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function escape(event) { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setOpen(false); button.current?.focus(); } }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  return <div className="floating-chat">
    {open && <section className="floating-chat-box" id="mess-chat-box" role="dialog" aria-labelledby="floating-chat-title"><header className="floating-chat-heading"><Icon name="chat" size={23} /><div><h2 id="floating-chat-title">{translate(owner ? 'Member messages' : 'Chat with owner')}</h2><p>{translate('Private mess conversation')}</p></div><button type="button" ref={closeButton} className="chat-close" aria-label={translate('Close chat')} onClick={() => { setOpen(false); button.current?.focus(); }}>×</button></header><ChatPanel /></section>}
    <button type="button" className="floating-chat-launcher" ref={button} tabIndex={open ? -1 : 0} aria-label={translate(open ? 'Close chat' : 'Open chat')} aria-expanded={open} aria-controls="mess-chat-box" onClick={() => setOpen(value => !value)}><Icon name="chat" size={25} />{unread > 0 && <span className="floating-chat-badge" aria-label={`${translate('Unread messages')}: ${unread}`}>{unread > 99 ? '99+' : unread}</span>}</button>
  </div>;
}
