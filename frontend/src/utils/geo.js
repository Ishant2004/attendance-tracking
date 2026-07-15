// Resolve the browser's location as { latitude, longitude }.
// A local watchdog guarantees the promise settles even if the browser never
// invokes either callback (e.g. the permission prompt is left open) — the
// native `timeout` option only counts once permission is already granted.
export function getCurrentPosition({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));

    let settled = false;
    const finish = (fn) => (arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      fn(arg);
    };
    const ok = finish(resolve);
    const fail = finish(reject);

    // Own timeout in case neither callback ever fires.
    const watchdog = setTimeout(
      () => fail(Object.assign(new Error('Location request timed out'), { code: 3 })), // 3 = TIMEOUT
      timeoutMs + 500
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => ok({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => fail(Object.assign(new Error(err.message || 'Could not get location'), { code: err.code })),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}
