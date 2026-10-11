import { useTranslation } from "../i18n/useTranslation";
import MenuItemPicker from "../components/MenuItemPicker";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MenuImage from "../components/MenuImage";
import MenuPhotoEditor from "../components/MenuPhotoEditor";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";

function ManageMeals() {
  const translate = useTranslation();
  const navigate = useNavigate();

  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const emptyForm = {
    single_price: "",
    date: "",
    meal_type: "lunch",
    menu_description: "",
    image_url: null,
    cutoff_time: "",
    is_complimentary: true
  };

  const [form, setForm] = useState(emptyForm);
  const acceptImage = useCallback((menu, url) => {
    setForm((previous) => previous.menu_description === menu ? { ...previous, image_url: url } : previous);
  }, []);

  const loadMeals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/owner/meals");

      setMeals(response.data);
    } catch (err) {
      console.error("Load meals error:", err);

      setError(
        errorMessage(err, "Unable to load meals.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {loadMeals();}, 0);
    return () => clearTimeout(timer);
  }, [loadMeals]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleChange = (event) => {
    const { name, value, type, checked } =
    event.target;

    setForm((previous) => ({
      ...previous,
      ...(name === "menu_description" ? { image_url: null } : {}),
      [name]:
      type === "checkbox" ?
      checked :
      value
    }));
  };

  const buildPayload = () => {
    return {
      single_price: form.single_price === "" ? null : Number(form.single_price),
      date: form.date,
      image_url: form.image_url,
      meal_type: form.meal_type,
      menu_description:
      form.menu_description.trim() || null,

      is_complimentary:
      form.is_complimentary,

      cutoff_time:
      form.cutoff_time ?
      new Date(
        `${form.date}T${form.cutoff_time}`
      ).toISOString() :
      null
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = buildPayload();


      if (editingId !== null) {
        await api.put(
          `/owner/meals/${editingId}`,
          payload
        );

        setMessage(
          "Meal updated successfully."
        );
      } else {
        await api.post(
          "/owner/meals",
          payload
        );

        setMessage(
          "Meal created successfully."
        );
      }

      setForm(emptyForm);
      setEditingId(null);

      await loadMeals();
    } catch (err) {
      console.error(
        "Save meal error:",
        err
      );

      setError(
        errorMessage(err, "Unable to save meal.")
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (meal) => {
    setError("");
    setMessage("");
    setEditingId(meal.id);

    let cutoff = "";

    if (meal.cutoff_time) {
      const date =
      new Date(/[Z]|[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`);

      const offset =
      date.getTimezoneOffset();

      const localDate =
      new Date(
        date.getTime() -
        offset * 60 * 1000
      );

      cutoff = localDate.
      toISOString().
      slice(11, 16);
    }

    setForm({
      single_price: meal.single_price ?? "",
      date: meal.date || "",
      image_url: meal.image_url || null,
      meal_type:
      meal.meal_type || "lunch",
      menu_description:
      meal.menu_description || "",
      cutoff_time: cutoff,
      is_complimentary:
      meal.is_complimentary ?? true
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const deleteMeal = async (mealId) => {
    setDeleting(true);
    setDeleteError("");
    setError("");
    setMessage("");

    try {
      await api.delete(
        `/owner/meals/${mealId}`
      );

      setMessage(
        "Meal deleted successfully."
      );

      setDeleteId(null);
      if (editingId === mealId) cancelEdit();
      await loadMeals();
    } catch (err) {
      console.error(
        "Delete meal error:",
        err
      );

      setDeleteError(errorMessage(err, "Unable to delete meal."));
    } finally {setDeleting(false);}
  };

  return (
    <>
      <Navbar title={translate("Manage Meals")} />

      <main className="dashboard">

        <section className="welcome">
          <div>
            <p className="eyebrow">{translate(" OWNER CONTROL ")}

            </p>

            <h1>{translate("Manage Meals")}</h1>

            <p>{translate(" Create and manage meals for your customers. ")}


            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={() =>
            navigate("/owner")
            }>{translate(" Back to Dashboard ")}


          </button>
        </section>

        <section className="management-card">

          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {translate(editingId ?
                "EDIT MEAL" :
                "NEW MEAL")}
              </p>

              <h2>
                {translate(editingId ?
                generating ? "Update menu without photo" : "Update Meal" :
                generating ? "Save menu without photo" : "Create Meal")}
              </h2>
            </div>
          </div>

          <form
            className="meal-form"
            onSubmit={handleSubmit}>
            

            <div className="form-field">
              <label>{translate("Date")}</label>

              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required />
              
            </div>

            <div className="form-field">
              <label>{translate("Meal Type")}</label>

              <select
                name="meal_type"
                value={form.meal_type}
                onChange={handleChange}
                required>
                
                <option value="breakfast">{translate(" Breakfast ")}

                </option>

                <option value="lunch">{translate(" Lunch ")}

                </option>

                <option value="dinner">{translate(" Dinner ")}

                </option>
              </select>
            </div>

            <MenuItemPicker key={editingId ?? `new-${meals.length}`} value={form.menu_description} onChange={(value) => handleChange({ target: { name: 'menu_description', value } })} />

            <div className="form-field">
              <label>{translate(" Meal Cutoff Time ")}

              </label>

              <input
                type="time"
                name="cutoff_time"
                value={form.cutoff_time}
                onChange={handleChange} required />
              <small>Uses the meal date selected above. Skips, guests and single-meal orders close at this time.</small>
              
            </div>

            <label className="form-field">Single-meal price (₹)<input type="number" name="single_price" min="0.01" max="10000" step="0.01" value={form.single_price} onChange={handleChange} placeholder="e.g. 120" /><small>Leave blank to disable single-meal ordering. Customers without a subscription can buy this meal at this price.</small></label>
            <MenuPhotoEditor menu={form.menu_description} imageUrl={form.image_url} onImage={acceptImage} onBusy={setGenerating} />
            <div className="form-actions">

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}>
                
                {translate(saving ?
                "Saving..." :
                editingId ?
                generating ? "Update menu without photo" : "Update Meal" :
                generating ? "Save menu without photo" : "Create Meal")}
              </button>

              {editingId &&
              <button
                type="button"
                className="btn btn-outline"
                onClick={cancelEdit}>{translate(" Cancel Edit ")}


              </button>
              }

            </div>
            <div className="form-wide" aria-live="polite">
              {error && <div className="alert error" role="alert">{translate(error)}</div>}
              {message && <div className="alert success" role="status">{translate(message)}</div>}
            </div>
          </form>
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{translate(" SCHEDULE ")}

              </p>

              <h2>{translate("Upcoming Meals")}</h2>
            </div>

            <button
              className="btn btn-outline"
              onClick={loadMeals}>{translate(" Refresh ")}


            </button>
          </div>

          {loading ?
          <div className="loading-card">{translate(" Loading meals... ")}

          </div> :
          meals.length === 0 ?
          <div className="empty-card">{translate(" No upcoming meals yet. Create your first meal above. ")}


          </div> :

          <div className="management-list">

              {meals.map((meal) =>
            <article
              className="management-row"
              key={meal.id}>
              

                  <MenuImage className="meal-thumbnail" menu={meal.menu_description} imageUrl={meal.image_url} />
                  <div className="meal-date-box">
                    <strong>
                      {translate(meal.date)}
                    </strong>
                  </div>

                  <div className="management-info">

                    <span className="meal-type">
                      {translate(meal.meal_type)}
                    </span>

                    <h3>
                      {translate(meal.menu_description ||
                  "No menu description")}
                    </h3>

                    {meal.cutoff_time &&
                <p>{translate(" Skip cutoff:")}
                  {translate(" ")}
                        {translate(new Date(
                    /[Z]|[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`
                  ).toLocaleString(translate.locale))}
                      </p>
                }

                  </div>

                  <div className="row-actions">
                    {deleteId === meal.id ? <div className="meal-delete-confirm" role="group" aria-label={translate("Confirm meal deletion")}>
                      <p>{translate("Delete this meal?")}</p>
                      {deleteError && <p className="alert error" role="alert">{translate(deleteError)}</p>}
                      <div className="form-actions"><button type="button" className="btn btn-danger-soft" disabled={deleting} onClick={() => deleteMeal(meal.id)}>{translate(deleting ? "Deleting…" : "Confirm delete")}</button><button type="button" className="btn btn-outline" disabled={deleting} onClick={() => {setDeleteId(null);setDeleteError("");}}>{translate("Cancel")}</button></div>
                    </div> : <><button type="button" className="btn btn-outline" disabled={deleting} onClick={() => startEdit(meal)}>{translate("Edit")}</button><button type="button" className="btn btn-outline" disabled={deleting} onClick={() => {setDeleteId(meal.id);setDeleteError("");}}>{translate("Delete")}</button></>}
                  </div>

                </article>
            )}

            </div>
          }
        </section>

      </main>
    </>);

}

export default ManageMeals;
