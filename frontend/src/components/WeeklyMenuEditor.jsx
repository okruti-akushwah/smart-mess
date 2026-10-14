import { useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import "./weekly-menu.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"];
const CUSTOM_MENU = "__custom_menu__";
const emptyItem = () => ({menu_description: "", cutoff_time: "", single_price: ""});
const timeAnchor = (weekday, value) => {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(Date.UTC(2026, 0, 5 + weekday, hour, minute));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const utcTime = (weekday, value) => {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(2026, 0, 5 + weekday, hour, minute);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
};

export default function WeeklyMenuEditor() {
  const translate = useTranslation();
  const [items, setItems] = useState({});
  const [menuChoices, setMenuChoices] = useState([]);
  const [weekday, setWeekday] = useState(0);
  const [mealType, setMealType] = useState("breakfast");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newDish, setNewDish] = useState("");
  const [addingDish, setAddingDish] = useState(false);
  const [dishError, setDishError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/owner/weekly-menu"), api.get("/owner/menu-items").catch(() => null)])
      .then(([response, catalogResponse]) => {
        if (!active) return;
        const next = {};
        response.data.forEach(item => {
          next[`${item.weekday}-${item.meal_type}`] = {
            menu_description: item.menu_description || "",
            cutoff_time: timeAnchor(item.weekday, item.cutoff_time),
            single_price: item.single_price ?? "",
          };
        });
        setItems(next);
        if (catalogResponse) {
          setMenuChoices(Array.isArray(catalogResponse.data) ? catalogResponse.data : []);
        }
      }).catch(err => setError(err.response?.status === 404
        ? "The connected backend does not have the weekly menu API yet. Restart the local backend or deploy the latest backend version, then reload this page."
        : errorMessage(err, "Unable to load the weekly menu.")))
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, []);

  const currentKey = `${weekday}-${mealType}`;
  const currentItem = items[currentKey] || emptyItem();
  const allMenuChoices = useMemo(() => {
    const unique = new Map();
    [...menuChoices, ...Object.values(items).map(item => item.menu_description)]
      .forEach(choice => {
        const value = String(choice || "").trim();
        if (value && !unique.has(value.toLocaleLowerCase())) unique.set(value.toLocaleLowerCase(), value);
      });
    return [...unique.values()].sort((a, b) => a.localeCompare(b));
  }, [items, menuChoices]);
  const selectedDishes = currentItem.menu_description.split(',').map(dish => dish.trim()).filter(Boolean);
  const dishChoices = [...new Set(['Dal', 'Roti', 'Sabji', 'Rice', 'Salad', 'Raita',
    ...allMenuChoices.flatMap(menu => menu.split(',').map(dish => dish.trim()).filter(Boolean))])]
    .filter((dish, index, dishes) => dishes.findIndex(item => item.toLocaleLowerCase() === dish.toLocaleLowerCase()) === index);

  const update = (field, value) => {
    setItems(previous => ({
      ...previous,
      [currentKey]: {...(previous[currentKey] || emptyItem()), [field]: value}
    }));
  };
  const toggleDish = dish => {
    const exists = selectedDishes.some(item => item.toLocaleLowerCase() === dish.toLocaleLowerCase());
    update('menu_description', (exists
      ? selectedDishes.filter(item => item.toLocaleLowerCase() !== dish.toLocaleLowerCase())
      : [...selectedDishes, dish]).join(', '));
  };
  async function addDish() {
    const name = newDish.trim();
    if (!name || addingDish) return;
    setAddingDish(true);setDishError("");
    try {
      const {data} = await api.post("/owner/menu-items", {name});
      setMenuChoices(previous => [...previous, data.name]);
      setItems(previous => {
        const item = previous[currentKey] || emptyItem();
        const dishes = item.menu_description.split(',').map(dish => dish.trim()).filter(Boolean);
        if (!dishes.some(dish => dish.toLocaleLowerCase() === data.name.toLocaleLowerCase())) dishes.push(data.name);
        return {...previous, [currentKey]: {...item, menu_description: dishes.join(', ')}};
      });
      setNewDish("");
    } catch (err) {setDishError(errorMessage(err, "Unable to add this dish."));}
    finally {setAddingDish(false);}
  }

  async function save(event) {
    event.preventDefault();
    const missingCutoff = Object.entries(items).find(([, item]) => item.menu_description.trim() && !item.cutoff_time);
    if (missingCutoff) {
      const [key] = missingCutoff;
      const [missingWeekday, missingMeal] = key.split("-");
      setWeekday(Number(missingWeekday));
      setMealType(missingMeal);
      setError(`Add a cutoff time for ${DAYS[Number(missingWeekday)]} ${missingMeal} before saving.`);
      setMessage("");
      return;
    }
    setSaving(true);setError("");setMessage("");
    try {
      const payload = Object.entries(items).flatMap(([key, item]) => {
        const [weekdayIndex, meal_type] = key.split("-");
        const menu_description = item.menu_description.trim();
        if (!menu_description) return [];
        return [{weekday: Number(weekdayIndex), meal_type, menu_description,
          cutoff_time: utcTime(Number(weekdayIndex), item.cutoff_time),
          single_price: item.single_price === "" ? null : Number(item.single_price),
          is_complimentary: true, image_url: null}];
      });
      const response = await api.put("/owner/weekly-menu", {items: payload});
      setMessage(response.data.message);
      window.dispatchEvent(new Event("meals-updated"));
    } catch (err) {
      setError(errorMessage(err, "Unable to save the weekly menu."));
    } finally {setSaving(false);}
  }

  const configuredCount = Object.values(items).filter(item => item.menu_description.trim()).length;

  return <section className="weekly-menu-editor">
    <header className="weekly-menu-heading">
      <div><p className="eyebrow">{translate("YOUR REPEATABLE MENU")}</p>
        <h2>{translate("Build your weekly menu")}</h2>
        <p>{translate("Choose a day and meal to add or update. Upcoming dates follow this menu, and you can edit it whenever your menu changes.")}</p></div>
      <span className="weekly-menu-stamp">{translate("7 DAYS · REPEATS")}</span>
    </header>
    {error && <div className="weekly-menu-error" role="alert"><span aria-hidden="true">!</span><div><strong>{translate("Weekly menu could not load")}</strong><p>{translate(error)}</p></div></div>}
    {message && <p className="alert success" role="status">{translate(message)}</p>}
    {loading ? <p role="status">{translate("Loading weekly menu…")}</p> : !error && <form onSubmit={save}>
      <div className="weekly-menu-selector">
        <div className="weekly-menu-selectors">
          <label>{translate("Day")}
            <select value={weekday} onChange={event => setWeekday(Number(event.target.value))}>
              {DAYS.map((day, index) => <option value={index} key={day}>{translate(day)}</option>)}
            </select>
          </label>
          <label>{translate("Meal")}
            <select value={mealType} onChange={event => setMealType(event.target.value)}>
              {MEALS.map(meal => <option value={meal} key={meal}>{translate(meal)}</option>)}
            </select>
          </label>
          <label>{translate("Add saved dishes")}
            <select value={CUSTOM_MENU} onChange={event => {
              if (event.target.value === CUSTOM_MENU) return;
              const added = event.target.value.split(',').map(dish => dish.trim()).filter(Boolean);
              const combined = [...selectedDishes];
              added.forEach(dish => { if (!combined.some(item => item.toLocaleLowerCase() === dish.toLocaleLowerCase())) combined.push(dish); });
              update("menu_description", combined.join(', '));
            }}>
              <option value={CUSTOM_MENU}>{translate("Select to add to this meal")}</option>
              {allMenuChoices.map(menu => <option value={menu} key={menu}>{menu}</option>)}
            </select>
          </label>
        </div>
        <p className="weekly-menu-selection-hint">{translate("Selected slot")}: <strong>{translate(DAYS[weekday])} · {translate(mealType)}</strong></p>
      </div>

      <div className="weekly-menu-details">
        <fieldset className="weekly-dish-picker"><legend>{translate("Build a complete meal")}</legend>
          <p>{translate("Select all the dishes you serve together. You can also type custom dishes below, separated by commas.")}</p>
          <div className="weekly-dish-options">{dishChoices.map(dish => <label key={dish}>
            <input type="checkbox" checked={selectedDishes.some(item => item.toLocaleLowerCase() === dish.toLocaleLowerCase())}
              onChange={() => toggleDish(dish)} />{dish}
          </label>)}</div>
          <div className="weekly-new-dish">
            <label htmlFor="weekly-new-dish">{translate("Add a new dish")}
              <input id="weekly-new-dish" type="text" maxLength={100} value={newDish} disabled={addingDish}
                placeholder={translate("For example: Aloo gobi")}
                onChange={event => {setNewDish(event.target.value);setDishError("");}}
                onKeyDown={event => {if (event.key === "Enter") {event.preventDefault();addDish();}}} />
            </label>
            <button type="button" className="btn btn-outline" disabled={addingDish || !newDish.trim()} onClick={addDish}>
              {translate(addingDish ? "Adding…" : "Add dish")}
            </button>
          </div>
          <p className="muted">{translate("Add one dish at a time. It is added to this meal and saved in your dish list. Save weekly menu to publish the meal.")}</p>
          {dishError && <p className="alert error" role="alert">{translate(dishError)}</p>}
        </fieldset>
        <label>{translate("Menu and dishes")}
          <textarea maxLength="500" rows="3" value={currentItem.menu_description}
            onChange={event => update("menu_description", event.target.value)}
            placeholder={translate("For example: Dal, rice, seasonal sabzi and roti")} />
        </label>
        <div className="weekly-meal-options">
          <label>{translate("Cutoff")}
            <input type="time" required={!!currentItem.menu_description.trim()} value={currentItem.cutoff_time}
              onChange={event => update("cutoff_time", event.target.value)} />
          </label>
          <label>{translate("Single meal price (₹)")}
            <input type="number" min="0.01" max="10000" step="0.01" value={currentItem.single_price}
              onChange={event => update("single_price", event.target.value)} placeholder={translate("Optional")} />
          </label>
        </div>
      </div>

      <div className="weekly-menu-save-row"><p>{translate("{count} of 21 meal slots have a menu. Blank slots stay unpublished.").replace("{count}", configuredCount)}</p>
        <button type="submit" className="btn btn-primary" disabled={saving}>{translate(saving ? "Saving…" : "Save weekly menu")}</button></div>
    </form>}
  </section>;
}
