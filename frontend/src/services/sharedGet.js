// Share concurrent reads only; resolved responses are never cached here.
export function sharedGet(get, context) {
  const pending = new Map();
  return (url, config = {}) => {
    if (config.signal || config.cancelToken || config.transformResponse || config.adapter) return get(url, config);
    const key = JSON.stringify([context(), url, config]);
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(() => get(url, config));
    const shared = request.finally(() => {if (pending.get(key) === shared) pending.delete(key);});
    pending.set(key, shared);
    return shared;
  };
}
