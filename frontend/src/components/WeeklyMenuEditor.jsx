import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import MenuItemPicker from "./MenuItemPicker";
import MenuPhotoEditor from "./MenuPhotoEditor";
import "./weekly-menu.css";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"];
const emptyItem = () => ({menu_description: "", cutoff_time: "", single_price: "", image_url: null});
function convertTime(day, value, toUTC = false) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const date = toUTC ? new Date(2026, 0, 5 + day, h, m) : new Date(Date.UTC(2026, 0, 5 + day, h, m));
  return `${String(toUTC ? date.getUTCHours() : date.getHours()).padStart(2, "0")}:${String(toUTC ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0")}`;
}
export default function WeeklyMenuEditor({oneTime, mode = "weekly", onModeChange}) {
  const translate = useTranslation();
  const editorRef = useRef(null);
  const [items, setItems] = useState({});
  const [weekday, setWeekday] = useState(0);
  const [mealType, setMealType] = useState("breakfast");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingSlot, setEditingSlot] = useState(null);
  const [beforeEdit, setBeforeEdit] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [savedItems,setSavedItems] = useState(null);
  useEffect(() => {
    let active = true;
    api.get("/owner/weekly-menu").then(({data}) => {
      if (!active) return;
      const loadedItems = Object.fromEntries(data.map(item => [`${item.weekday}-${item.meal_type}`, {
        ...item, menu_description: item.menu_description || "", cutoff_time: convertTime(item.weekday, item.cutoff_time), single_price: item.single_price ?? ""
      }]));
      setItems(loadedItems);setSavedItems(loadedItems);
    }).catch(err => {if (active) {setLoadFailed(true);setError(errorMessage(err, "Unable to load the weekly menu."));}})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, []);
  const currentKey = `${weekday}-${mealType}`;
  const dated = !!oneTime && mode === "date";
  const selectedItem = dated ? oneTime.form : items[currentKey] || emptyItem();
  const update = (field, value) => {
    if (dated) return oneTime.onChange({target: {name: field, value}});
    setItems(previous => ({...previous, [currentKey]: {...(previous[currentKey] || emptyItem()),
      ...(field === "menu_description" ? {image_url: null} : {}), [field]: value}}));
  };
  const acceptImage = (menu, url) => setItems(previous => {
    const item = previous[currentKey] || emptyItem();
    return item.menu_description === menu ? {...previous, [currentKey]: {...item, image_url: url}} : previous;
  });
  async function save(event) {
    event.preventDefault();
    const missing = Object.entries(items).find(([, item]) => item.menu_description.trim() && !item.cutoff_time);
    if (missing) {
      const [day, meal] = missing[0].split("-");
      setWeekday(Number(day));setMealType(meal);
      setError(`Add a cutoff time for ${DAYS[Number(day)]} ${meal} before saving.`);
      return;
    }
    setSaving(true);setError("");setMessage("");
    try {
      const payload = Object.entries(items).flatMap(([key, item]) => {
        const [day, meal_type] = key.split("-");
        if (!item.menu_description.trim()) return [];
        return [{weekday: Number(day), meal_type, menu_description: item.menu_description.trim(),
          cutoff_time: convertTime(Number(day), item.cutoff_time, true), single_price: item.single_price === "" ? null : Number(item.single_price),
          is_complimentary: item.is_complimentary ?? true, image_url: item.image_url || null}];
      });
      const {data} = await api.put("/owner/weekly-menu", {items: payload});
      setMessage(data.message);setSavedItems(items);setEditingSlot(null);setBeforeEdit(null);window.dispatchEvent(new Event("meals-updated"));
    } catch (err) {setError(errorMessage(err, "Unable to save the weekly menu."));}
    finally {setSaving(false);}
  }
  const count = Object.values(items).filter(item => item.menu_description.trim()).length;
  return <section className="weekly-menu-editor">
    <header className="weekly-menu-heading"><div><p className="eyebrow">{translate("YOUR MENU")}</p>
      <h2>{translate(oneTime ? dated ? "One-time meal change" : "Weekly menu" : "Build your weekly menu")}</h2>
      <p>{translate(oneTime ? dated ? "This changes only the selected date. Your weekly menu stays the same." : "Your weekly menu at a glance. Select a meal to edit it." : "Choose a day and meal to add or update. Upcoming dates follow this menu, and you can edit it whenever your menu changes.")}</p></div></header>
    {oneTime && <div className="meal-editor-modes" role="group" aria-label={translate("Schedule type")}>
      <button type="button" aria-pressed={!dated} disabled={saving || oneTime.saving || editingSlot !== null} onClick={() => onModeChange("weekly")}>{translate("Weekly repeat")}</button>
      <button type="button" aria-pressed={dated} disabled={saving || oneTime.saving || editingSlot !== null} onClick={() => onModeChange("date")}>{translate("Add a one-time meal")}</button>
    </div>}
    {!dated && error && <p className="alert error" role="alert">{translate(error)}</p>}
    {!dated && message && <p className="alert success" role="status">{translate(message)}</p>}
    {!dated && loading && <p role="status">{translate("Loading weekly menu…")}</p>}
    {oneTime && !dated && !loading && !loadFailed && <div className="weekly-overview-scroll" role="region" aria-label={translate("Weekly menu")} tabIndex={0}>
      <table className="weekly-overview"><thead><tr><th scope="col">{translate("Day")}</th>{MEALS.map(meal => <th scope="col" key={meal}>{translate(meal)}</th>)}</tr></thead>
        <tbody>{DAYS.map((day, index) => <tr key={day}><th scope="row">{translate(day)}</th>{MEALS.map(meal => {
          const item = items[`${index}-${meal}`];
          return <td key={meal}><p>{item?.menu_description || translate("Not set")}</p>
            <button type="button" className="weekly-slot-edit" disabled={saving || editingSlot !== null} aria-label={`${translate("Edit")} ${translate(day)} ${translate(meal)}`}
              onClick={() => {setBeforeEdit(items);setWeekday(index);setMealType(meal);setEditingSlot(`${index}-${meal}`);setError("");requestAnimationFrame(() => {editorRef.current?.scrollIntoView({behavior: "instant", block: "start"});editorRef.current?.querySelector("input:not([disabled])")?.focus({preventScroll:true});});}}>{translate(item?.menu_description ? "Change menu" : "Add meal")}</button>
          </td>;
        })}</tr>)}</tbody>
      </table>
    </div>}
    {(dated || (!loading && (!oneTime || editingSlot !== null))) && <form ref={editorRef} className="weekly-inline-editor" onSubmit={dated ? oneTime.onSubmit : save}>
      {oneTime && !dated && <div className="weekly-inline-heading"><h3>{translate(DAYS[weekday])} · {translate(mealType)}</h3>
        <button type="button" className="btn btn-outline" disabled={saving} onClick={() => {setItems(beforeEdit);setEditingSlot(null);setError("");}}>{translate("Cancel")}</button></div>}
      {(dated || !oneTime) && <div className="weekly-menu-selector"><div className="weekly-menu-selectors">
        {dated ? <label>{translate("Date")}<input type="date" required value={oneTime.form.date} onChange={e => update("date", e.target.value)} /></label> :
          <label>{translate("Day")}<select value={weekday} onChange={e => setWeekday(Number(e.target.value))}>{DAYS.map((day, index) => <option value={index} key={day}>{translate(day)}</option>)}</select></label>}
        <label>{translate("Meal Type")}<select value={dated ? oneTime.form.meal_type : mealType} onChange={e => dated ? update("meal_type", e.target.value) : setMealType(e.target.value)}>{MEALS.map(meal => <option value={meal} key={meal}>{translate(meal)}</option>)}</select></label>
      </div>{!dated && <p className="weekly-menu-selection-hint">{translate(dated ? "This changes only the selected date. Your weekly menu stays the same." : "Repeats every week. Save weekly menu to publish your changes.")}</p>}</div>}
      <p role="status">{translate(dated ? "Save this date to publish your changes." : savedItems && JSON.stringify(items) !== JSON.stringify(savedItems) ? "Unsaved changes" : "Saved weekly menu")}</p><div className="weekly-menu-details">
        <MenuItemPicker required={dated} value={selectedItem.menu_description} onChange={value => update("menu_description", value)} />
        <div className="weekly-meal-options">
          <label>{translate("Cutoff")}<input type="time" required={dated || !!selectedItem.menu_description.trim()} value={selectedItem.cutoff_time} onChange={e => update("cutoff_time", e.target.value)} /></label>
          <label>{translate("Single meal price (₹)")}<input type="number" min="0.01" max="10000" step="0.01" value={selectedItem.single_price} onChange={e => update("single_price", e.target.value)} placeholder={translate("Optional")} /></label>
        </div>
        <p className="muted">{translate("Leave blank to disable single-meal ordering. Members without a subscription can buy this meal at this price.")}</p>
        <details className="weekly-photo-options"><summary>{translate("Menu photo (optional)")}</summary><MenuPhotoEditor key={dated ? `date-${oneTime.editingId ?? "new"}` : currentKey} menu={selectedItem.menu_description} imageUrl={selectedItem.image_url}
          savedImageUrl={dated ? undefined : savedItems?.[currentKey]?.image_url || null} onImage={dated ? oneTime.onImage : acceptImage} onBusy={setGenerating} /></details>
      </div>
      <div className="weekly-menu-save-row"><p>{!dated && translate("{count} of 21 meal slots have a menu. Blank slots stay unpublished.").replace("{count}", count)}</p>
        <div className="form-actions">
          {dated && oneTime.editingId !== null && <button type="button" className="btn btn-outline" onClick={oneTime.onCancel}>{translate("Cancel Edit")}</button>}
          <button type="submit" className="btn btn-primary" disabled={dated ? oneTime.saving : saving || loading || loadFailed}>
            {translate((dated ? oneTime.saving : saving) ? "Saving…" : dated ? oneTime.editingId !== null ? generating ? "Update menu without photo" : "Update Meal" : generating ? "Save menu without photo" : "Create Meal" : "Save weekly menu")}
          </button>
        </div>
      </div>
      {dated && <div aria-live="polite">{oneTime.error && <p className="alert error">{translate(oneTime.error)}</p>}{oneTime.message && <p className="alert success">{translate(oneTime.message)}</p>}</div>}
    </form>}
  </section>;
}
