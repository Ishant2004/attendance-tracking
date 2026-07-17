import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useChat } from '../chat/ChatContext';
import { usersApi } from '../api/users';
import { Card, Spinner } from '../components/ui';

const ROLE_CHIP = {
  admin: 'bg-purple-100 text-purple-700',
  leadership: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-slate-100 text-slate-600',
};

// Node box + layout spacing (unscaled px).
const NODE_W = 200;
const NODE_H = 66;
const H_GAP = 28;
const V_GAP = 58;
const clampZoom = (z) => Math.min(2.5, Math.max(0.3, z));

export default function OrgDirectory() {
  const { user } = useAuth();
  const { openConversation } = useChat();
  const navigate = useNavigate();
  const uid = String(user._id || user.id);

  const messageUser = async (id) => {
    await openConversation(id);
    navigate('/chat');
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  const viewport = useRef(null);
  const drag = useRef(null);
  const didFit = useRef(false);
  const stateRef = useRef({ pan, zoom, size });
  stateRef.current = { pan, zoom, size };

  useEffect(() => {
    usersApi
      .tree()
      .then(setUsers)
      .catch((e) => setError(e.response?.data?.message || 'Failed to load directory'))
      .finally(() => setLoading(false));
  }, []);

  // Assemble the reporting forest and compute a tidy top-down layout (positions + connectors).
  const layout = useMemo(() => {
    const byId = new Map(users.map((u) => [String(u._id), { ...u, children: [] }]));
    const roots = [];
    for (const node of byId.values()) {
      const parent = node.manager && byId.get(String(node.manager));
      if (parent && parent !== node) parent.children.push(node);
      else roots.push(node); // admins (no manager) or reports of a deleted manager
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sortRec = (n) => {
      n.children.sort(byName);
      n.children.forEach(sortRec);
    };
    roots.sort(byName);
    roots.forEach(sortRec);

    const slotW = NODE_W + H_GAP;
    const levelH = NODE_H + V_GAP;
    const isCollapsed = (n) => collapsed.has(String(n._id));
    const nodes = [];
    let leaf = 0;
    const place = (n, depth) => {
      const kids = isCollapsed(n) ? [] : n.children;
      let x;
      if (kids.length === 0) {
        x = leaf * slotW;
        leaf += 1;
      } else {
        const xs = kids.map((c) => place(c, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      n._x = x;
      n._y = depth * levelH;
      nodes.push(n);
      return x;
    };
    for (const r of roots) {
      place(r, 0);
      leaf += 1; // gap between separate root trees
    }

    const edges = [];
    for (const n of nodes) {
      if (isCollapsed(n)) continue;
      for (const c of n.children) edges.push({ id: String(n._id) + '>' + String(c._id), from: n, to: c });
    }
    const width = nodes.reduce((m, n) => Math.max(m, n._x + NODE_W), 0) + 20;
    const height = nodes.reduce((m, n) => Math.max(m, n._y + NODE_H), 0) + 20;
    return { nodes, edges, width, height };
  }, [users, collapsed]);

  const query = q.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!query) return new Set();
    return new Set(
      layout.nodes
        .filter(
          (n) =>
            n.name.toLowerCase().includes(query) ||
            n.role.includes(query) ||
            (n.team?.name || '').toLowerCase().includes(query)
        )
        .map((n) => String(n._id))
    );
  }, [query, layout]);

  // --- viewport measurement, pan, zoom ---
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const applyZoom = useCallback((factor, sx, sy) => {
    const { pan: p, zoom: z } = stateRef.current;
    const nz = clampZoom(z * factor);
    setPan({ x: sx - (sx - p.x) * (nz / z), y: sy - (sy - p.y) * (nz / z) });
    setZoom(nz);
  }, []);

  const fit = useCallback(() => {
    const { w, h } = stateRef.current.size;
    if (!w) return;
    const z = clampZoom(Math.min((w - 48) / layout.width, (h - 48) / layout.height, 1));
    setZoom(z);
    setPan({ x: (w - layout.width * z) / 2, y: 24 });
  }, [layout.width, layout.height]);

  // Auto-fit once, after data + viewport size are known.
  useEffect(() => {
    if (!didFit.current && users.length && size.w) {
      fit();
      didFit.current = true;
    }
  }, [users, size, fit]);

  // Non-passive wheel zoom toward the cursor.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      setPan({ x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) });
    };
    const onUp = () => (drag.current = null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const centerOn = useCallback((n) => {
    const { w, h } = stateRef.current.size;
    const z = stateRef.current.zoom;
    setPan({ x: w / 2 - (n._x + NODE_W / 2) * z, y: h / 3 - (n._y + NODE_H / 2) * z });
  }, []);

  // Pan to the first match when the search changes.
  useEffect(() => {
    if (!query) return;
    const first = layout.nodes.find((n) => matched.has(String(n._id)));
    if (first) centerOn(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const zoomBtn = 'w-8 h-8 rounded-md bg-white border border-slate-300 text-slate-600 text-lg leading-none flex items-center justify-center shadow-sm hover:bg-slate-50';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Directory</h1>
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <Card title="Reporting hierarchy">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role, or team…"
            className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400">Drag to pan · scroll to zoom</span>
        </div>

        <div
          ref={viewport}
          onMouseDown={onMouseDown}
          className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 cursor-grab active:cursor-grabbing select-none"
          style={{ height: '68vh' }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: layout.width,
              height: layout.height,
              position: 'relative',
            }}
          >
            <svg
              width={layout.width}
              height={layout.height}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {layout.edges.map((e) => {
                const px = e.from._x + NODE_W / 2;
                const py = e.from._y + NODE_H;
                const cx = e.to._x + NODE_W / 2;
                const cy = e.to._y;
                const midY = py + V_GAP / 2;
                return (
                  <path
                    key={e.id}
                    d={`M ${px} ${py} V ${midY} H ${cx} V ${cy}`}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>

            {layout.nodes.map((n) => {
              const id = String(n._id);
              const isMe = id === uid;
              const isMatch = matched.has(id);
              const isCol = collapsed.has(id);
              const hasKids = n.children.length > 0;
              return (
                <div
                  key={id}
                  style={{ position: 'absolute', left: n._x, top: n._y, width: NODE_W, height: NODE_H }}
                  className={`rounded-lg border bg-white shadow-sm px-3 py-2 flex flex-col justify-center ${
                    isMe
                      ? 'border-indigo-400 ring-2 ring-indigo-200'
                      : isMatch
                      ? 'border-amber-400 ring-2 ring-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 truncate">{n.name}</span>
                    {isMe && <span className="text-[10px] text-indigo-500 shrink-0">(you)</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${ROLE_CHIP[n.role] || ROLE_CHIP.employee}`}>
                      {n.role}
                    </span>
                    {n.team?.name && <span className="text-[10px] text-slate-400 truncate">{n.team.name}</span>}
                  </div>
                  {!isMe && (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => messageUser(id)}
                      title={`Message ${n.name}`}
                      className="absolute top-1.5 right-1.5 text-slate-300 hover:text-indigo-600"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 20l1.4-4.2A8.5 8.5 0 1 1 21 11.5z" />
                      </svg>
                    </button>
                  )}
                  {hasKids && (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => toggle(id)}
                      title={isCol ? `Expand ${n.children.length}` : 'Collapse'}
                      style={{ position: 'absolute', bottom: -11, left: NODE_W / 2 - 11 }}
                      className="w-[22px] h-[22px] rounded-full bg-white border border-slate-300 text-slate-500 text-xs font-medium flex items-center justify-center shadow-sm hover:bg-slate-50"
                    >
                      {isCol ? n.children.length : '−'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button className={zoomBtn} title="Zoom in" onClick={() => applyZoom(1.2, size.w / 2, size.h / 2)}>+</button>
            <button className={zoomBtn} title="Zoom out" onClick={() => applyZoom(1 / 1.2, size.w / 2, size.h / 2)}>−</button>
            <button className={`${zoomBtn} text-xs`} title="Fit to screen" onClick={fit}>Fit</button>
          </div>
          <div className="absolute bottom-3 right-3 rounded bg-white/80 border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
            {Math.round(zoom * 100)}%
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/70">
              <Spinner />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
