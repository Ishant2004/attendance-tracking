import { useEffect, useState } from 'react';
import { attendanceApi } from '../api/attendance';
import { getCurrentPosition } from '../utils/geo';

const PING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Passive geo-fencing: one location ping when the user logs in, then every 15 minutes.
// It is NOT tied to check-in/out or tab focus — those never trigger a ping.
export function usePingLoop(enabled) {
  const [state, setState] = useState('idle'); // idle | active | denied | error | unsupported

  useEffect(() => {
    if (!enabled) return undefined;
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return undefined;
    }

    // Effect-local flags (not refs) so React StrictMode's double-invoke can't
    // leave a stale in-flight guard set.
    let cancelled = false;
    let inFlight = false;

    const ping = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return; // skip background-tab ticks
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

    ping(); // once, on login
    const timer = setInterval(ping, PING_INTERVAL_MS); // then every 15 min

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return state;
}
