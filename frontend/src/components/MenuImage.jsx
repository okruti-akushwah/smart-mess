import { useTranslation } from "../i18n/useTranslation";
import { menuImage } from "../services/menuImages";
import api from "../services/api";

export default function MenuImage({ menu, imageUrl, className }) {
  const translate = useTranslation();
  if (imageUrl) return <img className={className} src={`${api.defaults.baseURL.replace(/\/$/, "")}${imageUrl}`} alt={translate(`AI-generated photo of ${menu}`)} loading="lazy" />;
  const image = menuImage(menu);
  if (!image) return <div className={`${className} menu-image-empty`} role="img" aria-label={translate("No matching menu photo available")}><span>{translate("Menu photo coming soon")}</span></div>;
  return <img className={className} src={image.src} alt={translate(`Illustrative photo: ${image.label}`)} loading="lazy" />;
}
