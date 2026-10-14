export function safeReturnTo(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  const path = value.split(/[?#]/)[0];
  return path === "/login" || path === "/register" || path === "/signup" || path.startsWith("/owner") ? fallback : value;
}

export function returnTo(location, fallback = "/") {
  return safeReturnTo(new URLSearchParams(location.search).get("next") || location.state?.from, fallback);
}

export function loginUrl(destination) {
  return `/login?next=${encodeURIComponent(safeReturnTo(destination))}`;
}
