import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../chat/ChatContext';
import { usersApi } from '../api/users';
import { Card, Badge } from '../components/ui';

const timeShort = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const timeFull = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function Chat() {
  const {
    myId,
    conversations,
    messages,
    activeId,
    connected,
    openConversation,
    openConversationById,
    closeActive,
    sendMessage,
  } = useChat();

  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [uq, setUq] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const active = conversations.find((c) => c._id === activeId);
  const other = active?.participants.find((p) => String(p._id) !== myId);
  const thread = messages[activeId] || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length, activeId]);

  const openPicker = async () => {
    setPicker(true);
    if (!allUsers.length) {
      try {
        setAllUsers(await usersApi.tree());
      } catch {
        /* ignore */
      }
    }
  };

  const pickable = useMemo(() => {
    const q = uq.trim().toLowerCase();
    return allUsers
      .filter((u) => String(u._id) !== myId)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.role.includes(q));
  }, [allUsers, uq, myId]);

  const startWith = async (id) => {
    setPicker(false);
    setUq('');
    await openConversation(id);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !other || sending) return;
    setSending(true);
    setText('');
    await sendMessage(String(other._id), body);
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Chat</h1>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
          {connected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="flex" style={{ height: '68vh' }}>
          {/* Conversation list */}
          <div className={`w-full md:w-72 md:border-r border-slate-100 flex flex-col ${activeId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-slate-100">
              <button
                onClick={openPicker}
                className="w-full rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
              >
                + New message
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No conversations yet.</p>
              ) : (
                conversations.map((c) => {
                  const o = c.participants.find((p) => String(p._id) !== myId);
                  const unread = c.unread?.[myId] || 0;
                  return (
                    <button
                      key={c._id}
                      onClick={() => openConversationById(c._id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${
                        c._id === activeId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{o?.name || 'Unknown'}</span>
                        {unread > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage || 'No messages yet'}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={`flex-1 flex flex-col min-w-0 ${activeId ? 'flex' : 'hidden md:flex'}`}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Select a conversation or start a new one.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <button onClick={closeActive} className="md:hidden text-slate-500 mr-1" aria-label="Back">←</button>
                  <span className="font-semibold text-slate-800">{other?.name || 'Unknown'}</span>
                  {other?.role && <Badge tone="unknown">{other.role}</Badge>}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                  {thread.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center mt-8">No messages yet — say hello 👋</p>
                  ) : (
                    thread.map((m) => {
                      const mine = String(m.sender) === myId;
                      return (
                        <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                              mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                            }`}
                          >
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                            <div className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-slate-400'}`} title={timeFull(m.createdAt)}>
                              {timeShort(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <form onSubmit={send} className="p-3 border-t border-slate-100 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* New-message user picker */}
      {picker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPicker(false)}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-slate-800 mb-2">New message</h2>
            <input
              autoFocus
              value={uq}
              onChange={(e) => setUq(e.target.value)}
              placeholder="Search people…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <ul className="max-h-72 overflow-y-auto">
              {pickable.length === 0 ? (
                <li className="text-sm text-slate-400 px-2 py-3">No people found.</li>
              ) : (
                pickable.map((u) => (
                  <li key={u._id}>
                    <button
                      onClick={() => startWith(u._id)}
                      className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-md hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-800">{u.name}</span>
                      <span className="text-xs text-slate-400">{u.role}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
