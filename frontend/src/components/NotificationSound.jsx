import { useEffect, useState } from "react";
import api from "../services/api";

let audioContext;
let enabled = false;

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

export default function NotificationSound({ role }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState("");
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
  return <div><button className="btn btn-outline" type="button" onClick={toggle} aria-pressed={on} aria-label={on ? 'Mute notification sound' : 'Enable notification sound'} title={on ? 'Notification sound on — click to mute' : 'Enable notification sound'} style={{ padding: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />{!on && <path d="M3 3l18 18" />}</svg></button>{error && <small role="status">{error}</small>}</div>;
}
