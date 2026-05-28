// pages/dashboard.js
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ── Status badge ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    matched: { label: 'Matched', bg: '#0d2b1f', color: '#4ade80', border: '#166534' },
    unmatched: { label: 'No Match', bg: '#2b1414', color: '#f87171', border: '#991b1b' },
    logged: { label: 'Logged to GHL', bg: '#0d1f2b', color: '#60a5fa', border: '#1e40af' },
    ignored: { label: 'Ignored', bg: '#1e1e1e', color: '#9ca3af', border: '#374151' },
    pending: { label: 'Pending', bg: '#2b2314', color: '#fbbf24', border: '#92400e' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>{s.label}</span>
  );
}

// ── Contact search panel for unmatched records ───────────────────────────────
function ContactSearchPanel({ record, users, onResolved }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/ghl/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.contacts || []);
    } finally {
      setSearching(false);
    }
  }

  async function handleLog(contactId, createNew = false) {
    setSubmitting(true);
    try {
      const taskAssignments = record.tasks.map(t => ({
        id: t.id,
        description: t.description,
        ghlAssignee: t.ghlAssignee || 'ignore',
      }));

      const body = {
        emailId: record.emailId,
        contactId,
        createNew,
        contactName: record.parsed.contactName,
        contactPhone: record.parsed.contactPhone,
        tasks: taskAssignments,
      };

      const res = await fetch('/api/ghl/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) onResolved(record.emailId, 'logged');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIgnore() {
    setSubmitting(true);
    await fetch('/api/ghl/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: record.emailId, action: 'ignore' }),
    });
    onResolved(record.emailId, 'ignored');
    setSubmitting(false);
  }

  return (
    <div style={{ marginTop: 16, padding: 16, background: '#0d1117', borderRadius: 8, border: '1px solid #1e2d3d' }}>
      <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
        ⚠ No matching GHL contact found for <strong>{record.parsed.contactName}</strong> ({record.parsed.contactPhone})
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search GHL contacts by name or phone..."
          style={{
            flex: 1, padding: '8px 12px', background: '#161b22', border: '1px solid #30363d',
            borderRadius: 6, color: '#e6edf3', fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={search} disabled={searching} style={{
          padding: '8px 16px', background: '#1f6feb', color: '#fff', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {results.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} style={{
              padding: '10px 14px', marginBottom: 6, background: selected?.id === c.id ? '#1c2d40' : '#161b22',
              border: `1px solid ${selected?.id === c.id ? '#1f6feb' : '#30363d'}`,
              borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#1f6feb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {(c.firstName?.[0] || c.name?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>
                  {c.firstName} {c.lastName}
                </div>
                <div style={{ color: '#8b949e', fontSize: 12 }}>{c.phone} · {c.email}</div>
              </div>
              {selected?.id === c.id && <span style={{ marginLeft: 'auto', color: '#4ade80' }}>✓ Selected</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {selected && (
          <button onClick={() => handleLog(selected.id)} disabled={submitting} style={{
            padding: '8px 16px', background: '#238636', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {submitting ? 'Logging...' : `Log to ${selected.firstName} ${selected.lastName}`}
          </button>
        )}
        <button onClick={() => handleLog(null, true)} disabled={submitting} style={{
          padding: '8px 16px', background: '#1f6feb', color: '#fff', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          {submitting ? '...' : '+ Create New Contact'}
        </button>
        <button onClick={handleIgnore} disabled={submitting} style={{
          padding: '8px 16px', background: 'transparent', color: '#8b949e',
          border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer', fontSize: 13,
        }}>
          Ignore
        </button>
      </div>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, users, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
      borderBottom: '1px solid #1e2d3d',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#c9d1d9', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          {task.description}
        </p>
        {task.assigneeName && (
          <span style={{ color: '#8b949e', fontSize: 11 }}>Mentioned: {task.assigneeName}</span>
        )}
      </div>
      <select
        value={task.ghlAssignee || ''}
        onChange={e => onChange(task.id, e.target.value)}
        style={{
          padding: '6px 10px', background: '#161b22', border: '1px solid #30363d',
          borderRadius: 6, color: '#e6edf3', fontSize: 12, flexShrink: 0, width: 180,
        }}
      >
        <option value="">— Assign to —</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
        ))}
        <option value="ignore">🚫 Ignore task</option>
      </select>
      <Badge status={task.taskStatus || 'pending'} />
    </div>
  );
}

// ── Call note card ────────────────────────────────────────────────────────────
function CallNoteCard({ record, users, onRefresh }) {
  const [expanded, setExpanded] = useState(record.logStatus === 'pending');
  const [tasks, setTasks] = useState(record.tasks || []);
  const [submitting, setSubmitting] = useState(false);
  const [localRecord, setLocalRecord] = useState(record);

  function handleTaskAssign(taskId, assigneeId) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ghlAssignee: assigneeId } : t));
  }

  async function handleLog() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/ghl/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: record.emailId,
          contactId: record.ghlContact?.id,
          tasks: tasks.map(t => ({
            id: t.id,
            description: t.description,
            ghlAssignee: t.ghlAssignee || 'ignore',
          })),
        }),
      });

      if (res.ok) {
        setLocalRecord(prev => ({ ...prev, logStatus: 'logged' }));
        onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIgnore() {
    await fetch('/api/ghl/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: record.emailId, action: 'ignore' }),
    });
    setLocalRecord(prev => ({ ...prev, logStatus: 'ignored' }));
    onRefresh();
  }

  function handleResolved(emailId, status) {
    setLocalRecord(prev => ({ ...prev, logStatus: status }));
    onRefresh();
  }

  const p = record.parsed;
  const isLogged = localRecord.logStatus === 'logged';
  const isIgnored = localRecord.logStatus === 'ignored';
  const isDone = isLogged || isIgnored;

  return (
    <div style={{
      background: '#13181f', border: `1px solid ${isDone ? '#1e2d3d' : localRecord.matchStatus === 'unmatched' ? '#4a1515' : '#1e3a2a'}`,
      borderRadius: 10, marginBottom: 16, overflow: 'hidden',
      opacity: isDone ? 0.7 : 1, transition: 'opacity 0.3s',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: localRecord.matchStatus === 'matched' ? '#0d2b1f' : '#2b1414',
          border: `2px solid ${localRecord.matchStatus === 'matched' ? '#4ade80' : '#f87171'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: localRecord.matchStatus === 'matched' ? '#4ade80' : '#f87171',
          fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>
          {(p.contactName?.[0] || '?').toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15 }}>{p.contactName}</span>
            <span style={{ color: '#8b949e', fontSize: 13 }}>{p.contactPhone}</span>
            <Badge status={localRecord.matchStatus} />
            <Badge status={localRecord.logStatus} />
          </div>
          <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>
            {p.callDateTime} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {record.ghlContact && (
              <span style={{ color: '#4ade80', marginLeft: 8 }}>
                → {record.ghlContact.firstName} {record.ghlContact.lastName}
              </span>
            )}
          </div>
        </div>

        <span style={{ color: '#8b949e', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Summary */}
          {p.summary && (
            <div style={{
              background: '#0d1117', borderRadius: 8, padding: 14,
              marginBottom: 16, border: '1px solid #1e2d3d',
            }}>
              <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Summary</p>
              <p style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{p.summary}</p>
            </div>
          )}

          {/* Recap */}
          {p.recap && (
            <div style={{
              background: '#0d1117', borderRadius: 8, padding: 14,
              marginBottom: 16, border: '1px solid #1e2d3d',
            }}>
              <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>Recap</p>
              <p style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{p.recap}</p>
            </div>
          )}

          {/* Tasks */}
          {tasks.length > 0 && !isDone && (
            <div style={{
              background: '#0d1117', borderRadius: 8, padding: 14,
              marginBottom: 16, border: '1px solid #1e2d3d',
            }}>
              <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>
                Tasks — Assign or Ignore
              </p>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} users={users} onChange={handleTaskAssign} />
              ))}
            </div>
          )}

          {/* Unmatched contact search */}
          {localRecord.matchStatus === 'unmatched' && !isDone && (
            <ContactSearchPanel record={{ ...record, tasks }} users={users} onResolved={handleResolved} />
          )}

          {/* Matched contact actions */}
          {localRecord.matchStatus === 'matched' && !isDone && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={handleLog} disabled={submitting} style={{
                padding: '10px 22px', background: '#238636', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}>
                {submitting ? 'Logging...' : '✓ Log to GHL'}
              </button>
              <button onClick={handleIgnore} style={{
                padding: '10px 22px', background: 'transparent', color: '#8b949e',
                border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer', fontSize: 14,
              }}>
                Ignore
              </button>
            </div>
          )}

          {isDone && (
            <div style={{ color: '#8b949e', fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
              {isLogged ? '✓ Successfully logged to GoHighLevel' : '✗ Ignored'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [filter, setFilter] = useState('all');
  const [lastPoll, setLastPoll] = useState(null);

  const fetchRecords = useCallback(async () => {
    const res = await fetch('/api/records');
    const data = await res.json();
    setRecords(data.records || []);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [recordsRes, usersRes] = await Promise.all([
        fetch('/api/records'),
        fetch('/api/ghl/users'),
      ]);
      const recordsData = await recordsRes.json();
      const usersData = await usersRes.json();
      setRecords(recordsData.records || []);
      setUsers(usersData.users || []);
      setLoading(false);
    }
    init();
  }, []);

  async function triggerPoll() {
    setPolling(true);
    try {
      const res = await fetch('/api/poll');
      const data = await res.json();
      setLastPoll(data);
      await fetchRecords();
    } finally {
      setPolling(false);
    }
  }

  const filtered = records.filter(r => {
    if (filter === 'pending') return r.logStatus === 'pending';
    if (filter === 'unmatched') return r.matchStatus === 'unmatched';
    if (filter === 'logged') return r.logStatus === 'logged';
    if (filter === 'ignored') return r.logStatus === 'ignored';
    return true;
  });

  const counts = {
    all: records.length,
    pending: records.filter(r => r.logStatus === 'pending').length,
    unmatched: records.filter(r => r.matchStatus === 'unmatched').length,
    logged: records.filter(r => r.logStatus === 'logged').length,
    ignored: records.filter(r => r.logStatus === 'ignored').length,
  };

  return (
    <>
      <Head>
        <title>RingCentral → GHL Sync</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'Inter', sans-serif", color: '#e6edf3' }}>
        {/* Top nav */}
        <div style={{
          borderBottom: '1px solid #21262d', padding: '16px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#13181f', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 36, height: 36, background: 'linear-gradient(135deg, #1f6feb, #238636)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>📞</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#e6edf3', fontFamily: "'JetBrains Mono', monospace" }}>
                RingCentral → GHL
              </div>
              <div style={{ color: '#8b949e', fontSize: 12 }}>Call Notes Dashboard</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastPoll && (
              <span style={{ color: '#8b949e', fontSize: 12 }}>
                Last poll: {lastPoll.newRecords} new, {lastPoll.emailsChecked} checked
              </span>
            )}
            <button
              onClick={triggerPoll}
              disabled={polling}
              style={{
                padding: '8px 18px', background: polling ? '#1e2d3d' : '#1f6feb',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: polling ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
                transition: 'background 0.2s',
              }}
            >
              {polling ? '⟳ Polling...' : '⟳ Poll Now'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', color: '#8b949e' },
              { key: 'pending', label: 'Pending', color: '#fbbf24' },
              { key: 'unmatched', label: 'No Match', color: '#f87171' },
              { key: 'logged', label: 'Logged', color: '#4ade80' },
              { key: 'ignored', label: 'Ignored', color: '#6b7280' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '8px 18px', borderRadius: 20,
                  background: filter === f.key ? '#161b22' : 'transparent',
                  border: `1px solid ${filter === f.key ? f.color : '#30363d'}`,
                  color: filter === f.key ? f.color : '#8b949e',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {f.label} <span style={{
                  background: '#21262d', borderRadius: 999, padding: '1px 7px',
                  fontSize: 11, marginLeft: 4,
                }}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {/* Records */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: 80 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⟳</div>
              Loading call notes...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', color: '#8b949e', padding: 80,
              border: '1px dashed #21262d', borderRadius: 12,
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No call notes found</p>
              <p style={{ fontSize: 13 }}>
                {records.length === 0
                  ? 'Click "Poll Now" to check Ashley\'s inbox, or wait for the 5-minute auto-poll.'
                  : `No records match the "${filter}" filter.`}
              </p>
              {records.length === 0 && (
                <button onClick={triggerPoll} style={{
                  marginTop: 20, padding: '10px 24px', background: '#1f6feb',
                  color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                }}>
                  Poll Now
                </button>
              )}
            </div>
          ) : (
            filtered.map(record => (
              <CallNoteCard
                key={record.emailId}
                record={record}
                users={users}
                onRefresh={fetchRecords}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #21262d', padding: '16px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#8b949e', fontSize: 12 }}>
            Auto-polling every 5 minutes · ashley@gofedretire.com → GoHighLevel
          </span>
          <a href="/api/auth/login" style={{ color: '#1f6feb', fontSize: 12, textDecoration: 'none' }}>
            Re-authorize Outlook
          </a>
        </div>
      </div>
    </>
  );
}
