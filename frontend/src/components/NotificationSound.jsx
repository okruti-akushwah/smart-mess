import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api from "../services/api";
import { headcountSnapshot, headcountIncreased } from "../services/headcountSound";
import { incomingMessageCursor, hasIncomingMessage } from "../services/chatSound";

let audioContext;
let enabled = false;
const chatCursors = new Map();

function accountKey() {
  try {
    const payload = localStorage.getItem("token").split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return `notification-sound-seen:${JSON.parse(atob(payload)).sub}`;
  } catch { return null; }
}

function chime() {
  if (!enabled || audioContext?.state !== "running") return;
  const start = audioContext.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + index * 0.16);
    gain.gain.linearRampToValueAtTime(0.08, start + index * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + index * 0.16 + 0.25);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(start + index * 0.16); oscillator.stop(start + index * 0.16 + 0.26);
  });
}

export default function NotificationSound({ role, compact = false }) {
  const translate = useTranslation();

  const [on, setOn] = useState(enabled);
  const [error, setError] = useState("");
  const messToken = localStorage.getItem('activeMessToken');
  const chatAccount = accountKey();
  useEffect(() => {
    if (!['owner', 'customer'].includes(role) || !chatAccount || (role === 'customer' && !messToken)) return;
    const key = `${chatAccount}:${messToken || 'owner'}`;
    let active = true, fetching = false;
    async function checkMessages() {
      if (fetching) return;
      fetching = true;
      try {
        const { data } = await api.get('/chat/conversations');
        if (!active) return;
        const current = incomingMessageCursor(data);
        if (hasIncomingMessage(chatCursors.get(key), current)) chime();
        chatCursors.set(key, Math.max(current, chatCursors.get(key) || 0));
      } catch { /* Chat popup reports connection errors. Keep the last successful cursor. */ }
      finally { fetching = false; }
    }
    checkMessages();
    const timer = setInterval(checkMessages, 5000);
    window.addEventListener('focus', checkMessages);
    window.addEventListener('chat-updated', checkMessages);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', checkMessages); window.removeEventListener('chat-updated', checkMessages); };
  }, [role, messToken, chatAccount]);
  useEffect(() => {
    if (role !== 'owner') return;
    let active = true, loading = false, previous = null;
    async function checkHeadcount() {
      if (loading) return;
      loading = true;
      try {
        const { data } = await api.get('/dashboard/headcount');
        if (!active) return;
        const current = headcountSnapshot(data.preparation || []);
        if (headcountIncreased(previous, current)) chime();
        previous = current;
      } catch { /* Preserve the last successful counts during connection errors. */ }
      finally { loading = false; }
    }
    checkHeadcount();
    const timer = setInterval(checkHeadcount, 5000);
    window.addEventListener('focus', checkHeadcount);
    window.addEventListener('subscription-updated', checkHeadcount);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', checkHeadcount);
      window.removeEventListener('subscription-updated', checkHeadcount);
    };
  }, [role]);
  useEffect(() => {
    if (!['owner', 'customer'].includes(role)) return;
    let active = true, loading = false;
    const key = accountKey();
    let stored;
    try { stored = key ? localStorage.getItem(key) : null; } catch { stored = null; }
    let initialized = stored !== null;
    let seen;
    try { seen = new Set(JSON.parse(stored || '[]')); } catch { seen = new Set(); initialized = false; }
    async function load() {
      if (loading) return;
      loading = true;
      try {
        let ids;
        if (role === 'customer') {
          const { data } = await api.get('/bills/issued');
          ids = data.filter(b => !b.seen && b.status !== 'cancelled').map(b => `bill:${b.id}`);
        } else {
          const responses = await Promise.allSettled([
            api.get('/owner/join-requests'), api.get('/payments/submissions'), api.get('/owner/personal-orders'),
          ]);
          if (responses.some(r => r.status === 'rejected')) return;
          const [joins, payments, orders] = responses.map(r => r.value.data);
          ids = [...joins.map(r => `join:${r.id}`),
            ...payments.filter(r => r.status === 'pending').map(r => `payment:${r.id}`),
            ...orders.filter(r => r.status === 'pending_acceptance' && !r.accepted).map(r => `order:${r.plan_id}`)];
        }
        if (!active) return;
        const hasNew = ids.some(id => !seen.has(id));
        if (initialized && hasNew) chime();
        ids.forEach(id => seen.add(id));
        initialized = true;
        try { if (key) localStorage.setItem(key, JSON.stringify([...seen])); } catch { /* Keep memory tracking if browser storage is unavailable. */ }
      } catch { /* Existing request panels report connection errors. */ }
      finally { loading = false; }
    }
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [role]);
  async function toggle() {
    if (enabled) { enabled = false; setOn(false); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Sound unavailable');
      audioContext ||= new Audio();
      await audioContext.resume();
      enabled = audioContext.state === 'running'; setOn(enabled); setError('');
      chime();
    } catch { setError('Notification sound is unavailable in this browser.'); }
  }
  return <div className="notification-sound"><button className={`btn btn-outline${compact ? ' workspace-icon-button' : ''}`} type="button" onClick={toggle} aria-pressed={on} aria-label={on ? translate("Mute notification sound") : translate("Enable notification sound")} title={on ? translate("Notification sound on — click to mute") : translate("Enable notification sound")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />{!on && <path d="M3 3l18 18" />}</svg></button>{error && <small role="status">{translate(error)}</small>}</div>;
}
