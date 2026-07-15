import { useEffect, useRef, useState } from 'react';
import { attendanceApi } from '../api/attendance';
import { getCurrentPosition } from '../utils/geo';

const PING_INTERVAL_MS = 5 * 60 * 1000;

// Passive geo-fencing: while enabled and the tab is visible, POST a location
// ping now and every 5 min. Returns a status for the UI indicator.
export function usePingLoop(enabled) {
  const [state, setState] = useState('idle'); // idle | active | denied | error | unsupported
  const timerRef = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return undefined;
    }

    let cancelled = false;

    const ping = async () => {
      if (document.visibilityState !== 'visible' || inFlight.current) return;
      inFlight.current = true;
      try {
        const coords = await getCurrentPosition();
        if (cancelled) return;
        await attendanceApi.ping(coords);
        if (!cancelled) setState('active');
      } catch (e) {
        if (!cancelled) setState(e && e.code === 1 ? 'denied' : 'error'); // 1 = permission denied
      } finally {
        inFlight.current = false;
      }
    };

    const start = () => {
      ping(); // immediate ping on start/resume
      clearInterval(timerRef.current);
      timerRef.current = setInterval(ping, PING_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else clearInterval(timerRef.current);
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return state;
}