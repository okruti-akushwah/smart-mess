import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
import './owner-enhancements.css';
const fields = [['name', 'Mess name'], ['address', 'Full address'], ['contact', 'Public contact number or email'], ['hours', 'Meal timings'], ['about', 'About your mess'], ['preparation', 'How you prepare meals']];
const times = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String(i % 4 * 15).padStart(2, '0')}`);
function timeLabel(value) {const [h, m] = value.split(':').map(Number);return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;}
export default function MessProfileEditor() {
  const translate = useTranslation();
  const [form, setForm] = useState(null),[editing, setEditing] = useState([]),[error, setError] = useState(''),[message, setMessage] = useState(''),[busy, setBusy] = useState(false),[timingChanged, setTimingChanged] = useState(false);
  useEffect(() => {let active = true;api.get('/owner/mess-profile').then((r) => {if (active) {setForm(r.data);setEditing(r.data.profile_saved ? fields.filter(([key]) => key === 'hours' ? !r.data.hours && !r.data.timings.length : !r.data[key]?.trim()).map(([key]) => key) : fields.map(([key]) => key));}}).catch((e) => {if (active) setError(errorMessage(e));});return () => {active = false;};}, []);
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try {const payload = Object.fromEntries(fields.map(([key]) => [key, form[key]]));if (timingChanged) payload.timings = form.timings;
      const r = await api.put('/owner/mess-profile', payload);setForm(r.data);setEditing([]);setTimingChanged(false);setMessage(r.data.message);
    } catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  function timing(meal, key, value) {
    setTimingChanged(true);
    setForm((previous) => {const rows = previous.timings.filter((t) => t.meal_type !== meal);const old = previous.timings.find((t) => t.meal_type === meal);
      if (key === 'enabled') return { ...previous, timings: value ? [...rows, { meal_type: meal, from_time: '', to_time: '' }] : rows };
      return { ...previous, timings: [...rows, { ...old, [key]: value }] };});
  }
  return <section className="management-card"><h2>{translate("Your public mess page")}</h2><p>{translate("These details are visible to everyone. Saved fields are locked; use the pencil beside a field to edit it.")}</p>{error && !form && <p className="alert error" role="alert">{translate(error)}</p>}{form && <form className="meal-form" onSubmit={submit}>{fields.map(([key, label]) => {
        const locked = !editing.includes(key);
        return <div className={`form-field public-edit-field ${locked ? 'is-locked' : ''} ${key === 'hours' ? 'form-wide' : ''}`} key={key}><div className="field-heading"><label htmlFor={`public-${key}`}>{translate(label)}</label><button type="button" className="field-pencil" aria-label={translate(`Edit ${label}`)} title={translate(`Edit ${label}`)} disabled={busy || !locked} onClick={() => setEditing([...editing, key])}>✎</button></div>{key === 'hours' ? <div id="public-hours">{!form.timings.length && form.hours && <p className="muted">{translate("Current timings: ")}{translate(form.hours)}{translate(". Select meal time ranges below to replace this text.")}</p>}{['breakfast', 'lunch', 'dinner'].map((meal) => {
              const row = form.timings.find((t) => t.meal_type === meal);
              return <div className="timing-row" key={meal}><label className="timing-toggle"><input type="checkbox" disabled={locked || busy} checked={Boolean(row)} onChange={(e) => timing(meal, 'enabled', e.target.checked)} />{translate(meal[0].toUpperCase() + meal.slice(1))}</label>{['from_time', 'to_time'].map((part, i) => <label key={part}>{translate(i === 0 ? 'From' : 'To')}<select aria-label={translate(`${meal} ${i === 0 ? 'from' : 'to'}`)} disabled={locked || busy || !row} required={Boolean(row)} value={row?.[part] || ''} onChange={(e) => timing(meal, part, e.target.value)}><option value="">{translate("Select time")}</option>{[...new Set([...times, ...(row?.[part] ? [row[part]] : [])])].sort().map((t) => <option key={t} value={t}>{translate(timeLabel(t))}</option>)}</select></label>)}</div>;})}</div> : ['about', 'preparation', 'address'].includes(key) ? <textarea id={`public-${key}`} disabled={locked || busy} rows={key === 'preparation' ? 5 : 3} maxLength={key === 'preparation' ? 3000 : key === 'about' ? 2000 : 500} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /> : <input id={`public-${key}`} disabled={locked || busy} maxLength={100} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}</div>;
      })}<div className="form-actions"><button className="btn btn-primary" disabled={busy || !editing.length}>{translate(busy ? 'Saving…' : 'Save public details')}</button><a className="btn btn-outline" target="_blank" rel="noreferrer" href={`/mess/${form.join_token}`}>{translate("Preview public page")}</a></div>{error && <p className="alert error form-wide" role="alert">{translate(error)}</p>}{message && <p className="alert success form-wide" role="status">{translate(message)}</p>}</form>}</section>;
}
