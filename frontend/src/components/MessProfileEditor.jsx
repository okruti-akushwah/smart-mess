import { useTranslation } from "../i18n/useTranslation";
import { Fragment, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
import './owner-enhancements.css';
const fields = [['owner_name', 'Public owner name'], ['business_type', 'Business type'], ['tagline', 'Tagline'], ['food_type', 'Food type'], ['service_type', 'Service type (e.g. breakfast, lunch, dinner)'], ['operating_days', 'Operating days'], ['opening_time', 'Opening time'], ['closing_time', 'Closing time'], ['city', 'City'], ['area', 'Area / locality'], ['fssai_number', 'FSSAI registration number (14 digits)'], ['business_status', 'Business status'], ['name', 'Mess name (English)'], ['name_hi', 'Mess name (Hindi, optional)'], ['address', 'Full address (English)'], ['address_hi', 'Full address (Hindi, optional)'], ['contact', 'Public contact number or email'], ['hours', 'Meal timings'], ['about', 'About your mess (English)'], ['about_hi', 'About your mess (Hindi, optional)'], ['preparation', 'How you prepare meals (English)'], ['preparation_hi', 'How you prepare meals (Hindi, optional)']];
const choices = {
  business_type: ['Home-style tiffin service', 'Mess service', 'Tiffin and mess service', 'Cloud kitchen', 'Catering service'],
  food_type: ['Pure vegetarian', 'Vegetarian and non-vegetarian', 'Non-vegetarian', 'Jain food', 'Vegan'],
  service_type: ['Breakfast, lunch and dinner', 'Lunch and dinner', 'Breakfast and lunch', 'Lunch only', 'Dinner only', 'Breakfast only'],
  operating_days: ['Monday to Sunday', 'Monday to Saturday', 'Monday to Friday', 'Saturday and Sunday'],
  business_status: ['Active', 'Temporarily closed', 'Closed'],
};
const sections = {owner_name: 'Basic information', opening_time: 'Opening hours & location', name: 'Public page content'};
function ChoiceField({field, value, disabled, onChange, translate}) {
  const options = choices[field];
  const [custom, setCustom] = useState(Boolean(value && !options.includes(value)));
  const allowCustom = field !== 'business_status';
  return <>
    <select id={`public-${field}`} disabled={disabled} value={custom ? '__custom__' : value || ''} onChange={event => {
      const selected = event.target.value;
      setCustom(selected === '__custom__');
      if (selected !== '__custom__') onChange(selected);
      else if (options.includes(value)) onChange('');
    }}>
      <option value="">{translate('Select an option (optional)')}</option>
      {options.map(option => <option key={option} value={option}>{translate(option)}</option>)}
      {allowCustom && <option value="__custom__">{translate('Other / custom')}</option>}
    </select>
    {custom && allowCustom && <input aria-label={translate(`Custom ${field.replaceAll('_', ' ')}`)} disabled={disabled} maxLength={100} placeholder={translate('Enter your own details')} value={value || ''} onChange={event => onChange(event.target.value)} />}
  </>;
}
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
  return <section className="management-card"><h2>{translate("Your public mess page")}</h2><p>{translate("These details are visible to everyone. Saved fields are locked; use the pencil beside a field to edit it.")}</p><p className="muted">{translate("Add Hindi text for Hindi visitors. Empty Hindi fields use your existing English text. Text is not translated automatically.")}</p>{error && !form && <p className="alert error" role="alert">{translate(error)}</p>}{form && <form className="meal-form" onSubmit={submit}><div className="form-wide form-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditing(fields.map(([key]) => key))}>{translate("Edit all details")}</button><span className="muted">{translate("All fields are optional. Only saved details appear on your public page.")}</span></div>{fields.map(([key, label]) => {
        const locked = !editing.includes(key);
        return <Fragment key={key}>{sections[key] && <h3 className="form-wide">{translate(sections[key])}</h3>}<div className={`form-field public-edit-field ${locked ? 'is-locked' : ''} ${key === 'hours' ? 'form-wide' : ''}`} key={key}><div className="field-heading"><label htmlFor={`public-${key}`}>{translate(label)}</label><button type="button" className="field-pencil" aria-label={translate(`Edit ${label}`)} title={translate(`Edit ${label}`)} disabled={busy || !locked} onClick={() => setEditing([...editing, key])}>✎</button></div>{key === 'hours' ? <div id="public-hours">{!form.timings.length && form.hours && <p className="muted">{translate("Current timings: ")}{translate(form.hours)}{translate(". Select meal time ranges below to replace this text.")}</p>}{['breakfast', 'lunch', 'dinner'].map((meal) => {
              const row = form.timings.find((t) => t.meal_type === meal);
              return <div className="timing-row" key={meal}><label className="timing-toggle"><input type="checkbox" disabled={locked || busy} checked={Boolean(row)} onChange={(e) => timing(meal, 'enabled', e.target.checked)} />{translate(meal[0].toUpperCase() + meal.slice(1))}</label>{['from_time', 'to_time'].map((part, i) => <label key={part}>{translate(i === 0 ? 'From' : 'To')}<select aria-label={translate(`${meal} ${i === 0 ? 'from' : 'to'}`)} disabled={locked || busy || !row} required={Boolean(row)} value={row?.[part] || ''} onChange={(e) => timing(meal, part, e.target.value)}><option value="">{translate("Select time")}</option>{[...new Set([...times, ...(row?.[part] ? [row[part]] : [])])].sort().map((t) => <option key={t} value={t}>{translate(timeLabel(t))}</option>)}</select></label>)}</div>;})}</div> : ['about', 'preparation', 'address', 'about_hi', 'preparation_hi', 'address_hi'].includes(key) ? <textarea id={`public-${key}`} disabled={locked || busy} rows={key.startsWith('preparation') ? 5 : 3} maxLength={key.startsWith('preparation') ? 3000 : key.startsWith('about') ? 2000 : 500} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /> : choices[key] ? <ChoiceField field={key} value={form[key] || ""} disabled={locked || busy} translate={translate} onChange={value => setForm({ ...form, [key]: value })} /> : key.endsWith('_time') ? <select id={`public-${key}`} disabled={locked || busy} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}><option value="">{translate('Select time (optional)')}</option>{[...new Set([...times, ...(form[key] ? [form[key]] : [])])].sort().map(value => <option key={value} value={value}>{timeLabel(value)}</option>)}</select> : <input id={`public-${key}`} type={key.endsWith('_time') ? 'time' : 'text'} pattern={key === 'fssai_number' ? '[0-9]{14}' : undefined} inputMode={key === 'fssai_number' ? 'numeric' : undefined} disabled={locked || busy} maxLength={key === 'tagline' ? 150 : key === 'fssai_number' ? 14 : 100} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={translate(key === 'city' ? 'e.g. Jaipur' : key === 'area' ? 'e.g. Mansarovar' : key === 'tagline' ? 'e.g. Fresh home-style meals, every day' : key === 'owner_name' ? 'Name customers should see' : key === 'fssai_number' ? 'Enter 14 digits, if registered' : 'Enter details')} />}</div></Fragment>;
      })}<div className="form-actions"><button className="btn btn-primary" disabled={busy || !editing.length}>{translate(busy ? 'Saving…' : 'Save public details')}</button><a className="btn btn-outline" target="_blank" rel="noreferrer" href={`/mess/${form.join_token}`}>{translate("Preview public page")}</a></div>{error && <p className="alert error form-wide" role="alert">{translate(error)}</p>}{message && <p className="alert success form-wide" role="status">{translate(message)}</p>}</form>}</section>;
}
