import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import api, { errorMessage } from '../services/api';
import './messages.css';

export default function ChatPanel() {
  const translate = useTranslation();
  const owner = localStorage.getItem('role') === 'owner';
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const { data } = await api.get('/chat/conversations');
        if (active) {
          setConversations(data);
          setSelected(current => data.some(row => row.customer_id === current) ? current : data[0]?.customer_id ?? null);
          setError('');
        }
      } catch (err) { if (active) setError(errorMessage(err, 'Unable to load messages.')); }
      finally { fetching = false; if (active) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener('focus', load);
    window.addEventListener('chat-updated', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('chat-updated', load); };
  }, []);
  const conversation = conversations.find(row => row.customer_id === selected);
  return <div className="messages-page chat-panel-content">
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {loading ? <p className="loading-card" role="status">{translate('Loading messages…')}</p> : <section className={`messenger ${owner ? 'messenger-owner' : ''}`} aria-label={translate('Messages')}>
      {owner && <div className="chat-member-select"><label htmlFor="chat-member">{translate('Members')}</label><select id="chat-member" value={selected ?? ''} onChange={event => setSelected(Number(event.target.value))}>{!conversations.length && <option value="">{translate('No members yet')}</option>}{conversations.map(row => <option key={row.customer_id} value={row.customer_id}>{row.name}{row.unread ? ` (${row.unread} ${translate('Unread messages')})` : ''}</option>)}</select></div>}
      {conversation ? <Conversation key={selected} conversation={conversation} owner={owner} /> : <p className="empty-card">{translate('Select a member to start chatting.')}</p>}
    </section>}
  </div>;
}

function Conversation({ conversation, owner }) {
  const translate = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const lastId = useRef(0), key = useRef(crypto.randomUUID()), bottom = useRef(null), viewport = useRef(null), autoScroll = useRef(true), readCursor = useRef(0);
  const customerId = conversation.customer_id;
  useEffect(() => {
    let active = true, fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const first = lastId.current === 0;
        const { data } = await api.get('/chat/messages', { params: { customer_id: customerId, after_id: lastId.current } });
        if (!active) return;
        if (first) setOlder(data.has_more);
        const rows = data.messages;
        if (rows.length) {
          lastId.current = Math.max(lastId.current, rows.at(-1).id);
          setMessages(current => [...new Map([...current, ...rows].map(row => [row.id, row])).values()].sort((a, b) => a.id - b.id));
        }
        setError('');
      } catch (err) { if (active) setError(errorMessage(err, 'Unable to load messages.')); }
      finally { fetching = false; if (active) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener('focus', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [customerId]);

  useEffect(() => {
    // Scroll the conversation only; scrollIntoView also moves enclosing panels/pages.
    if (autoScroll.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
    function readVisible() {
      if (document.visibilityState !== 'visible' || !autoScroll.current || !messages.length) return;
      const id = messages.at(-1).id;
      if (id <= readCursor.current) return;
      readCursor.current = id;
      api.patch('/chat/read', { customer_id: customerId, last_message_id: id })
        .then(() => window.dispatchEvent(new Event('chat-updated'))).catch(() => { readCursor.current = 0; });
    }
    readVisible();
    window.addEventListener('focus', readVisible);
    window.addEventListener('chat-read-visible', readVisible);
    document.addEventListener('visibilitychange', readVisible);
    return () => { window.removeEventListener('focus', readVisible); window.removeEventListener('chat-read-visible', readVisible); document.removeEventListener('visibilitychange', readVisible); };
  }, [messages, customerId]);

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true); setSendError('');
    try {
      const { data } = await api.post('/chat/messages', { customer_id: customerId, body: draft, client_key: key.current });
      autoScroll.current = true;
      setMessages(current => [...new Map([...current, data].map(row => [row.id, row])).values()].sort((a, b) => a.id - b.id));
      setDraft(''); key.current = crypto.randomUUID();
      window.dispatchEvent(new Event('chat-updated'));
    } catch (err) { setSendError(errorMessage(err, 'Message could not be sent. Your text is kept; please retry.')); }
    finally { setBusy(false); }
  }
  async function loadOlder() {
    setLoadingOlder(true);
    try {
      const { data } = await api.get('/chat/messages', { params: { customer_id: customerId, before_id: messages[0].id } });
      autoScroll.current = false;
      setMessages(current => [...new Map([...data.messages, ...current].map(row => [row.id, row])).values()].sort((a, b) => a.id - b.id));
      setOlder(data.has_more); setError('');
    } catch (err) { setError(errorMessage(err, 'Unable to load messages.')); }
    finally { setLoadingOlder(false); }
  }
  return <div className="messenger-thread"><header className="messenger-thread-header"><span className="messenger-avatar" aria-hidden="true">{conversation.name.slice(0, 1)}</span><div><h2>{conversation.name}</h2><p>{owner ? translate('Mess member') : conversation.mess_name || translate('Mess owner')}</p></div><small>{translate('Updates every 5 seconds')}</small></header>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    <div className="messenger-scroll" ref={viewport} role="log" aria-label={translate('Conversation')} aria-live="polite" onScroll={() => { const el = viewport.current; autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (autoScroll.current) window.dispatchEvent(new Event('chat-read-visible')); }}>
      {older && <button className="btn btn-outline" disabled={loadingOlder} onClick={loadOlder}>{translate(loadingOlder ? 'Loading…' : 'Load earlier messages')}</button>}
      {loading ? <p role="status">{translate('Loading messages…')}</p> : !messages.length && <div className="messenger-empty"><h3>{translate('Start a conversation')}</h3><p>{translate(owner ? 'Send a message to this member.' : 'Send your owner a question about meals, delivery or your plan.')}</p></div>}
      {messages.map(message => <article className={`chat-bubble ${message.from_owner === owner ? 'chat-mine' : ''}`} key={message.id}><span className="sr-only">{translate(message.from_owner === owner ? 'You' : owner ? 'Mess member' : 'Mess owner')}</span><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(translate.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></article>)}<div ref={bottom} />
    </div>
    <form className="messenger-compose" onSubmit={send}><label className="sr-only" htmlFor="chat-message">{translate('Your message')}</label><textarea id="chat-message" value={draft} maxLength={2000} rows={2} disabled={busy} placeholder={translate('Type your message…')} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (!busy && draft.trim()) event.currentTarget.form.requestSubmit(); } }} onChange={event => { setDraft(event.target.value); key.current = crypto.randomUUID(); }} /><button className="btn btn-primary chat-send-button" disabled={busy || !draft.trim()} aria-label={translate(busy ? 'Sending…' : 'Send message')} title={translate(busy ? 'Sending…' : 'Send message')}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg></button><small className="chat-character-count">{draft.length}/2000</small>{sendError && <p className="alert error" role="alert">{translate(sendError)}</p>}</form>
  </div>;
}
