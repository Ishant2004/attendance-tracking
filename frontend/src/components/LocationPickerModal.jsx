import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentPosition } from '../utils/geo';

const round = (n) => Number(n.toFixed(6));

// Click the map, search a place, or use current location to pick coords → { latitude, longitude }.
export default function LocationPickerModal({ initial, onPick, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [coords, setCoords] = useState(
    initial?.latitude && initial?.longitude
      ? { latitude: Number(initial.latitude), longitude: Number(initial.longitude) }
      : null
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

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

  // Move the map + pin to a coordinate.
  const goTo = (lat, lng, zoom = 16) => {
    const rlat = round(lat);
    const rlng = round(lng);
    setCoords({ latitude: rlat, longitude: rlng });
    const map = mapRef.current;
    map.setView([rlat, rlng], zoom);
    if (markerRef.current) markerRef.current.setLatLng([rlat, rlng]);
    else
      markerRef.current = L.circleMarker([rlat, rlng], {
        radius: 9, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.85, weight: 2,
      }).addTo(map);
  };

  const useMyLocation = async () => {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      goTo(latitude, longitude, 16);
    } catch {
      /* ignore — user can still click the map */
    }
  };

  const search = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      setResults(res.ok ? await res.json() : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (r) => {
    goTo(Number(r.lat), Number(r.lon), 16);
    setResults([]);
    setSearched(false);
    setQuery(r.display_name.split(',')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Choose location</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-slate-100 relative">
          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place or address…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={searching} className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {(results.length > 0 || (searched && !searching)) && (
            <ul className="absolute left-5 right-5 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto z-[1000]">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
              ) : (
                results.map((r) => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      onClick={() => selectResult(r)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div ref={containerRef} style={{ height: '60vh', width: '100%' }} />

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
