import { useTranslation } from "../i18n/useTranslation";
import { menuImage } from "../services/menuImages";
import api from "../services/api";
import { useState } from "react";

export default function MenuImage({ menu, imageUrl, className, altText }) {
  const translate = useTranslation();
  const [failed, setFailed] = useState(() => new Set());
  const fail = source => setFailed(previous => new Set([...previous, source]));
  const remote = imageUrl ? `${api.defaults.baseURL.replace(/\/$/, "")}${imageUrl}` : null;
  if (remote && !failed.has(remote)) return <img className={className} src={remote} alt={altText || `${translate(imageUrl.includes("/upload-") ? "Uploaded photo" : "Menu photo")}: ${menu}`} loading="lazy" onError={() => fail(remote)} />;
  const image = menuImage(menu);
  if (!image || failed.has(image.src)) return <div className={`${className || ''} menu-image-empty`} role="img" aria-label={translate("No matching menu photo available")}><span>{translate("Menu photo coming soon")}</span></div>;
  return <img className={className} src={image.src} alt={translate(`Illustrative photo: ${image.label}`)} loading="lazy" onError={() => fail(image.src)} />;
}
