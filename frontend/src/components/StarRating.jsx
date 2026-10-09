import { useTranslation } from "../i18n/useTranslation";
import { useState } from "react";
import "./star-rating.css";

const descriptions = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export default function StarRating({ value, onChange, disabled = false }) {
  const translate = useTranslation();
  const [hover, setHover] = useState(0);
  const selected = Number(value);
  return <fieldset className="star-rating" disabled={disabled}>
    <legend>{translate("Rating")}</legend>
    <div className="star-rating-options" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => <label key={star} className={`star-rating-option ${(hover || selected) >= star ? "is-filled" : ""}`} onMouseEnter={() => setHover(star)}>
        <input type="radio" name="meal-rating" value={star} checked={selected === star} onChange={() => onChange(String(star))} aria-label={translate(`${star} out of 5 stars — ${descriptions[star - 1]}`)} />
        <span aria-hidden="true">★</span>
      </label>)}
    </div>
    <span className="star-rating-description" aria-live="polite">{translate(selected ? `${selected} out of 5 · ${descriptions[selected - 1]}` : "Choose a star rating")}</span>
  </fieldset>;
}
