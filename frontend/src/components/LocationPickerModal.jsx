import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentPosition } from '../utils/geo';

const round = (n) => Number(n.toFixed(6));

// Click on the map (or use current location) to drop a pin; returns { latitude, longitude }.
export default function LocationPickerModal({ initial, onPick, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [coords, setCoords] = useState(
    initial?.latitude && initial?.longitude
      ? { latitude: Number(initial.latitude), longitude: Number(initial.longitude) }
      : null
  );

  useEffect(() => {
    const start = coords ? [coords.latitude, coords.longitude] : [12.9716, 77.5946]; // default: Bangalore
    const map = L.map(containerRef.current).setView(start, coords ? 15 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const place = (lat, lng) => {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 9,
          color: '#4f46e5',
          fillColor: '#4f46e5',
          fillOpacity: 0.85,
          weight: 2,
        }).addTo(map);
    };
    if (coords) place(coords.latitude, coords.longitude);

    map.on('click', (e) => {
      const lat = round(e.latlng.lat);
      const lng = round(e.latlng.lng);
      setCoords({ latitude: lat, longitude: lng });
      place(lat, lng);
    });

    mapRef.current = map;
    // Modal mounts before layout settles — recalc tiles.
    setTimeout(() => map.invalidateSize(), 120);
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = async () => {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const lat = round(latitude);
      const lng = round(longitude);
      setCoords({ latitude: lat, longitude: lng });
      const map = mapRef.current;
      map.setView([lat, lng], 16);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 9, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.85, weight: 2,
        }).addTo(map);
    } catch {
      /* ignore — user can still click the map */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Choose location</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div ref={containerRef} style={{ height: "70vh", width: '100%' }} />

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-slate-100">
          <button
            type="button"
            onClick={useMyLocation}
            className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Use my current location
          </button>
          <span className="text-sm text-slate-500">
            {coords ? `Pin: ${coords.latitude}, ${coords.longitude}` : 'Click on the map to drop a pin'}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="text-sm rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              disabled={!coords}
              onClick={() => onPick(coords)}
              className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Use this location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
