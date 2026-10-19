import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
import './owner-enhancements.css';

export default function MenuItemPicker({ value, onChange, required = true }) {
  const translate = useTranslation();
  const [items, setItems] = useState([]), [draft, setDraft] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.get('/owner/menu-items').then(r => {if (active) setItems(r.data);}).catch(e => {if (active) setError(errorMessage(e));});
    return () => {active = false;};
  }, []);
  const selected = value.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
  const isSelected = name => selected.some(t => t.toLowerCase() === name.toLowerCase());
  const choices = [...items];
  for (const name of selected.filter(t => t.length <= 100)) if (!choices.some(i => i.toLowerCase() === name.toLowerCase())) choices.push(name);
  function append(name) {if (name && !isSelected(name)) onChange([...selected, name].join(', '));}
  function remove(name) {onChange(selected.filter(t => t.toLowerCase() !== name.toLowerCase()).join(', '));}
  async function add() {
    if (!draft.trim()) return;
    setBusy(true);setError('');
    try {
      const r = await api.post('/owner/menu-items', {name: draft.trim()});
      setItems(previous => previous.some(i => i.toLowerCase() === r.data.name.toLowerCase()) ? previous : [...previous, r.data.name]);
      append(r.data.name);setDraft('');
    } catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  return <div className="form-field form-wide menu-item-picker">
    <label htmlFor="menu-description">{translate("Menu Description")}</label>
    <input id="menu-description" name="menu_description" required={required} maxLength={500} value={value} onChange={e => onChange(e.target.value)} placeholder={translate("Daal, Roti, Raita, Salad")} />
    <small>{translate("Type dishes separated by commas, or choose from saved dishes.")}</small>
    <details className="saved-dish-options"><summary>{translate("Choose from saved dishes")}</summary>    <span className="menu-picker-label">{translate("Choose dishes for this meal")}</span>
    <div className="menu-dish-grid" role="group" aria-label={translate("Meal dishes")}>
      {choices.map(item => <div className={`menu-dish-row ${isSelected(item) ? "is-selected" : ''}`} key={item}>
        <span>{translate(item)}</span><div className="menu-dish-controls">
          <button type="button" disabled={!isSelected(item)} aria-label={`${translate("Remove from meal")}: ${translate(item)}`} onClick={() => remove(item)}>−</button>
          <button type="button" disabled={isSelected(item)} aria-label={`${translate("Add to meal")}: ${translate(item)}`} onClick={() => append(item)}>+</button>
        </div>
      </div>)}
    </div>
    <div className="menu-picker-tools">
      <input aria-label={translate("New dish name")} placeholder={translate("Type a new dish")} maxLength={100} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault();add();}}} />
      <button type="button" className="btn btn-outline" disabled={busy || !draft.trim()} onClick={add}>{translate(busy ? 'Adding…' : 'Add new dish')}</button>
    </div>
</details>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
  </div>;
}
