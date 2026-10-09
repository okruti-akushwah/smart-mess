import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import MenuImage from "./MenuImage";
import "./menu-photo-editor.css";
function PhotoIcon({ kind }) {

  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "ai" ? <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /> : <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m3 16 5-5 4 4 3-3 6 6" /></>}</svg>;
}
export default function MenuPhotoEditor({ menu, imageUrl, onImage, onBusy }) {
  const translate = useTranslation();
  const [mode, setMode] = useState("upload");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => {request.current?.abort();request.current = null;onBusy(false);}, [menu, mode, onBusy]);
  async function run(file) {
    request.current?.abort();
    const controller = new AbortController();request.current = controller;
    setBusy({ menu, mode });onBusy(true);setError("");
    try {
      let response;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB");
        const data = new FormData();data.append("file", file);
        response = await api.post("/owner/menu-images/upload", data, { signal: controller.signal, headers: { "Content-Type": "multipart/form-data" } });
      } else response = await api.post("/owner/menu-images", { menu_description: menu.trim() }, { timeout: 210000, signal: controller.signal });
      if (!controller.signal.aborted) onImage(menu, response.data.image_url);
    } catch (e) {if (!controller.signal.aborted) setError(e.response ? errorMessage(e) : e.message || "Unable to add photo. Please retry.");} finally
    {if (request.current === controller) {request.current = null;setBusy(null);onBusy(false);}}
  }
  const pending = busy?.menu === menu && busy?.mode === mode;
  return <section className="form-wide menu-photo-editor" aria-label={translate("Menu photo")}>
    <header className="photo-heading"><div><p className="eyebrow">{translate("MAKE IT APPETIZING")}</p><h3>{translate("Add a menu photo")}</h3><p>{translate("A little preview of what's cooking.")}</p></div><span className="photo-optional">{translate("Optional")}</span></header>
    <div className="photo-workspace"><div className="photo-controls">
      <div className="photo-source-options" role="group" aria-label={translate("Photo source")}>
        {[{ id: "upload", title: "Upload a photo", detail: "Use your own picture" }, { id: "ai", title: "Create with AI", detail: "Bring your menu to life" }].map((option) => <button key={option.id} type="button" className={`photo-source ${mode === option.id ? "is-selected" : ""}`} aria-pressed={mode === option.id} disabled={pending} onClick={() => {setMode(option.id);setError("");}}><span className="photo-source-icon"><PhotoIcon kind={option.id} /></span><span><strong>{translate(option.title)}</strong><small>{translate(option.detail)}</small></span><span className="photo-radio" /></button>)}
      </div>
      {mode === "upload" ? <label className={`photo-upload-zone ${pending ? "is-busy" : ""}`}>
        <input className="photo-file-input" type="file" accept="image/png,image/jpeg" disabled={pending} onChange={(e) => {const file = e.target.files?.[0];if (file) run(file);e.target.value = "";}} />
        <span className="photo-upload-icon"><PhotoIcon /></span><strong>{translate(pending ? "Uploading your photo..." : imageUrl ? "Choose a replacement photo" : "Choose your meal photo")}</strong><span>{translate("PNG or JPG · Up to 5 MB")}</span><span className="photo-browse">{translate("Browse files ")}<span aria-hidden="true">↗</span></span>
      </label> : <div className="photo-ai-panel"><span className="photo-ai-caption"><PhotoIcon kind="ai" />{translate(" Made from your menu")}</span><p className="photo-menu-description">{translate(menu.trim() || "Add your dishes to the menu first.")}</p><button type="button" className="btn btn-primary photo-generate" disabled={pending || menu.trim().length < 3} onClick={() => run()}><PhotoIcon kind="ai" />{translate(pending ? "Creating your photo..." : "Generate photo")}</button><small>{translate("Only generates when you click. Existing photos are reused.")}</small></div>}
      {pending && <p className="photo-progress" role="status"><span className="photo-spinner" />{translate(mode === "upload" ? "Adding your photo..." : "Cooking up your photo. This may take a minute.")}</p>}
      {error && <div className="alert error photo-error" role="alert">{translate(error)}</div>}
    </div><div className="photo-preview-card"><div className="photo-preview-top"><span>{translate("MENU PREVIEW")}</span>{imageUrl && <span className="photo-ready">{translate("✓ Ready")}</span>}</div>
      {imageUrl ? <MenuImage className="menu-photo-preview" menu={menu} imageUrl={imageUrl} /> : <div className="photo-preview-empty"><span><PhotoIcon /></span><strong>{translate("Your photo goes here")}</strong><p>{translate("Upload your own or let AI")}<br />{translate("create one for your menu.")}</p></div>}
      <div className="photo-preview-footer"><span>{translate(imageUrl ? "Save the meal to publish this photo." : "A photo is optional. Your menu comes first.")}</span>{imageUrl && <button type="button" className="photo-remove" disabled={pending} onClick={() => onImage(menu, null)}>{translate("Remove")}</button>}</div>
    </div></div>
  </section>;
}
