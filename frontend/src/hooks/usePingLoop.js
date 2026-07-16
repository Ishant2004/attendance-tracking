import { useEffect, useState } from 'react';
import { attendanceApi } from '../api/attendance';
import { getCurrentPosition } from '../utils/geo';

const PING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Passive geo-fencing: while enabled and the tab is visible, POST a location
// ping now and every 5 min. Returns a status for the UI indicator.
export function usePingLoop(enabled) {
  const [state, setState] = useState('idle'); // idle | active | denied | error | unsupported

  useEffect(() => {
    if (!enabled) return undefined;
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return undefined;
    }

    // Effect-local (not refs): each mount cycle gets its own flags, so React
    // StrictMode's double-invoke can't leave a stale in-flight guard set.
    let cancelled = false;
    let inFlight = false;
    let timer = null;

    const ping = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        const coords = await getCurrentPosition();
        if (cancelled) return;
        await attendanceApi.ping(coords);
        if (!cancelled) setState('active');
      } catch (e) {
        if (!cancelled) setState(e && e.code === 1 ? 'denied' : 'error'); // 1 = permission denied
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      ping(); // immediate ping on start/resume
      clearInterval(timer);
      timer = setInterval(ping, PING_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else clearInterval(timer);
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return state;
}
