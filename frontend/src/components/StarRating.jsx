import { useTranslation } from "../i18n/useTranslation";
import { useId, useState } from "react";
import "./star-rating.css";

const descriptions = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export default function StarRating({ value, onChange, disabled = false }) {
  const translate = useTranslation();
  const groupName = useId();
  const [hover, setHover] = useState(0);
  const selected = Number(value);
  return <fieldset className="star-rating" disabled={disabled}>
    <legend>{translate("Rating")}</legend>
    <div className="star-rating-options" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => <label key={star} className={`star-rating-option ${(hover || selected) >= star ? "is-filled" : ""}`} onMouseEnter={() => setHover(star)}>
        <input type="radio" name={groupName} disabled={disabled} value={star} checked={selected === star} onChange={() => onChange?.(String(star))} aria-label={translate("{count} out of 5 stars — {description}").replace('{count}', star).replace('{description}', translate(descriptions[star - 1]))} />
        <span aria-hidden="true">★</span>
      </label>)}
    </div>
    <span className="star-rating-description" aria-live="polite">{selected ? translate("{count} out of 5 · {description}").replace('{count}', selected).replace('{description}', translate(descriptions[selected - 1])) : translate("Choose a star rating")}</span>
  </fieldset>;
}
