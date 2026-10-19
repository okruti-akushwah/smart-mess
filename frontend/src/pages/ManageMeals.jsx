import ALaCarteManager from "../components/ALaCarteManager";
import OwnerPage from "../components/OwnerPage";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MenuImage from "../components/MenuImage";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import WeeklyMenuEditor from "../components/WeeklyMenuEditor";

function ManageMeals() {
  const translate = useTranslation();
  const navigate = useNavigate();
  const dateChangesRef = useRef(null);

  const [scheduleDate, setScheduleDate] = useState("");
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editorMode, setEditorMode] = useState("weekly");
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
    window.addEventListener("meals-updated", loadMeals);
    return () => window.removeEventListener("meals-updated", loadMeals);
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
    setEditorMode("date");

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

    if (dateChangesRef.current) {
      dateChangesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setEditorMode("weekly");
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

      <OwnerPage className="owner-weekly-menu-page">

        <section className="welcome">
          <div>
            <p className="eyebrow">{translate("OWNER CONTROL")}

            </p>

            <h1>{translate("Manage your menu")}</h1><a href="#a-la-carte-catalogue">{translate("À la carte menu")}</a>

            <p>{translate("Plan your regular week here. Use upcoming meals for changes to a single date.")}


            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={() =>
            navigate("/owner")
            }>{translate(" Back to Dashboard ")}


          </button>
        </section>


        <div ref={dateChangesRef} className="combined-meal-editor">
          <WeeklyMenuEditor mode={editorMode} onModeChange={setEditorMode} oneTime={{
            form, onChange: handleChange, onSubmit: handleSubmit, onImage: acceptImage,
            editingId, onCancel: cancelEdit, saving, error, message
          }} />
        </div>

        <details className="meal-schedule-panel">
          <summary><span>{translate("Upcoming meals by date")}</span><small>{translate("View or change a single date")}</small></summary>
        <section className="management-card">
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

          {meals.length > 0 && <label className="schedule-date-filter">{translate("Choose a date")}
            <select value={scheduleDate || meals[0]?.date || ""} onChange={event => setScheduleDate(event.target.value)}>
              {[...new Set(meals.map(meal => meal.date))].sort().map(date => <option key={date} value={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(translate.locale, {weekday: 'short', day: 'numeric', month: 'short'})}</option>)}
            </select>
          </label>}
          {error && <p className="alert error" role="alert">{translate(error)}</p>}
          {message && <p className="alert success" role="status">{translate(message)}</p>}
          {loading ?
          <div className="loading-card">{translate(" Loading meals... ")}

          </div> :
          meals.length === 0 ?
          <div className="empty-card">{translate("No upcoming meals yet. Set your weekly menu above.")}


          </div> :

          <div className="management-list">

              {meals.filter(meal => meal.date === (scheduleDate || meals[0]?.date)).map((meal) =>
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
                    </div> : <><button type="button" className="btn btn-outline" disabled={deleting} onClick={() => startEdit(meal)}>{translate("Change this date")}</button><button type="button" className="btn btn-outline" disabled={deleting} onClick={() => {setDeleteId(meal.id);setDeleteError("");}}>{translate("Delete")}</button></>}
                  </div>

                </article>
            )}

            </div>
          }
        </section>
        </details>

        <ALaCarteManager />
      </OwnerPage>
    </>);

}

export default ManageMeals;
