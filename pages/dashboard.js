import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

function Badge({ status }) {
  const map = {
    matched: { label: 'Matched', bg: '#dcfce7', color: '#15803d', border: '#86efac' },
    unmatched: { label: 'No Match', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    logged: { label: 'Logged', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    ignored: { label: 'Ignored', bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
    pending: { label: 'Pending', bg: '#fef3c7', color: '#d97706', border: '#fcd34d' },
    created: { label: 'Created', bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

function formatPhone(digits) {
  if (!digits) return '';
  const d = digits.replace(/\D/g, '').slice(-10);
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return digits;
}

function ContactSearchPanel({ record, users, onResolved }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [localTasks, setLocalTasks] = useState(record.tasks || []);

  // Auto-search by phone number on mount using formatted number
  useEffect(() => {
    if (record.parsed.contactPhone) {
      const formatted = formatPhone(record.parsed.contactPhone);
      setQuery(formatted);
      searchByQuery(formatted);
    }
  }, []);

  async function searchByQuery(q) {
    if (!q?.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/ghl/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.contacts || []);
    } finally { setSearching(false); }
  }

  async function search() {
    await searchByQuery(query);
  }

  async function handleLog(contactId, createNew = false) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/ghl/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: record.emailId,
          contactId,
          createNew,
          contactName: record.parsed.contactName,
          contactPhone: record.parsed.contactPhone,
        }),
      });
      if (res.ok) onResolved(record.emailId, 'logged');
    } finally { setSubmitting(false); }
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
    <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
      <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
        ⚠ No matching GHL contact found for{' '}
        <strong>{record.parsed.contactName || formatPhone(record.parsed.contactPhone) || 'Unknown Contact'}</strong>
        {record.parsed.contactPhone && ` · ${formatPhone(record.parsed.contactPhone)}`}
      </p>

      {/* Task assignment shown after contact is selected */}

      {/* GHL possible matches by phone or name */}
      {record.ghlPossibleMatches && record.ghlPossibleMatches.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            ⚠ Possible GHL matches — select the correct one
          </p>
          {record.ghlPossibleMatches.map((c, i) => (
            <div key={i} onClick={() => setSelected(c)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: selected?.id === c.id ? '#eff6ff' : '#fff',
              border: `1px solid ${selected?.id === c.id ? '#2563eb' : '#fcd34d'}`,
              borderRadius: 8, marginBottom: 6, cursor: 'pointer',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(c.firstName?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{c.firstName} {c.lastName}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{c.phone} {c.email ? `· ${c.email}` : ''}</div>
              </div>
              {selected?.id === c.id && <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* Extracted name from summary */}
      {record.extractedName && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fefce8', border: '1px solid #fde047', borderRadius: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            💡 Name found in call notes
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{record.extractedName}</span>
            <button
              onClick={() => { setQuery(record.extractedName); searchByQuery(record.extractedName); }}
              style={{ padding: '3px 10px', background: '#fef08a', border: '1px solid #fde047', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#854d0e', fontWeight: 600 }}
            >
              Search GHL →
            </button>
          </div>
        </div>
      )}

      {/* CNAM name */}
      {record.cnamResult?.name && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            📞 CNAM Caller ID
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{record.cnamResult.name}</span>
            <button
              onClick={() => { setQuery(record.cnamResult.name); searchByQuery(record.cnamResult.name); }}
              style={{ padding: '3px 10px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#15803d', fontWeight: 600 }}
            >
              Search GHL →
            </button>
          </div>
        </div>
      )}

      {/* Suggestions from Outlook/RingCentral */}
      {record.contactSuggestions && record.contactSuggestions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Found in other sources
          </p>
          {record.contactSuggestions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 6,
            }}>
              <div style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: s.source === 'Outlook' ? '#dbeafe' : '#fef3c7',
                color: s.source === 'Outlook' ? '#1d4ed8' : '#d97706',
                border: `1px solid ${s.source === 'Outlook' ? '#93c5fd' : '#fcd34d'}`,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{s.source}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{s.name}</span>
                {s.email && <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>{s.email}</span>}
              </div>
              <button
                onClick={() => setQuery(s.name)}
                style={{ padding: '4px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' }}
              >
                Search GHL →
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search GHL contacts by name or phone..."
          style={{ flex: 1, padding: '8px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111', fontSize: 13, outline: 'none' }}
        />
        <button onClick={search} disabled={searching} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {results.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} style={{
              padding: '10px 14px', marginBottom: 6, background: selected?.id === c.id ? '#eff6ff' : '#fff',
              border: `1px solid ${selected?.id === c.id ? '#2563eb' : '#e5e7eb'}`,
              borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(c.firstName?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#111', fontWeight: 600, fontSize: 13 }}>{c.firstName} {c.lastName}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{c.phone} · {c.email}</div>
              </div>
              {selected?.id === c.id && <span style={{ marginLeft: 'auto', color: '#16a34a' }}>✓ Selected</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {selected && (
          <button onClick={() => handleLog(selected.id)} disabled={submitting} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {submitting ? 'Logging...' : `Log to ${selected.firstName} ${selected.lastName}`}
          </button>
        )}
        <button onClick={() => handleLog(null, true)} disabled={submitting} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          {submitting ? '...' : '+ Create New Contact'}
        </button>
        <button onClick={handleIgnore} disabled={submitting} style={{ padding: '8px 16px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Ignore
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, users, contactId, emailId, onTaskCreated }) {
  const [assigning, setAssigning] = useState(null);
  const isDone = task.taskStatus === 'created' || task.taskStatus === 'ignored';

  async function assign(userId) {
    if (!contactId) {
      alert('No GHL contact linked yet — log the note first or select a contact.');
      return;
    }
    setAssigning(userId);
    try {
      const res = await fetch('/api/ghl/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId,
          taskId: task.id,
          assignedTo: userId,
          contactId,
        }),
      });
      if (res.ok) {
        onTaskCreated(task.id, userId, 'created');
      } else {
        const err = await res.json();
        alert(`Task failed: ${err.error}`);
      }
    } catch(e) {
      alert(`Task error: ${e.message}`);
    } finally { setAssigning(null); }
  }

  function ignore() {
    onTaskCreated(task.id, 'ignore', 'ignored');
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: isDone ? 0 : 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#374151', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{task.description}</p>
          {task.assigneeName && <span style={{ color: '#9ca3af', fontSize: 11 }}>Mentioned: {task.assigneeName}</span>}
        </div>
        <Badge status={task.taskStatus || 'pending'} />
      </div>
      {!isDone && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => assign(u.id)}
              disabled={!!assigning}
              style={{
                padding: '5px 12px', background: assigning === u.id ? '#dbeafe' : '#eff6ff',
                color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 20,
                cursor: assigning ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {assigning === u.id ? '...' : `+ Assign to ${u.firstName}`}
            </button>
          ))}
          <button
            onClick={ignore}
            style={{ padding: '5px 12px', background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 20, cursor: 'pointer', fontSize: 12 }}
          >
            🚫 Ignore
          </button>
        </div>
      )}
      {task.taskStatus === 'created' && (
        <p style={{ color: '#16a34a', fontSize: 12, margin: '6px 0 0', fontWeight: 600 }}>
          ✓ Task created in GHL
        </p>
      )}
    </div>
  );
}

function CallNoteCard({ record, users, onRefresh }) {
  const [expanded, setExpanded] = useState(record.logStatus === 'pending');
  const [tasks, setTasks] = useState(record.tasks || []);
  const [submitting, setSubmitting] = useState(false);
  const [localStatus, setLocalStatus] = useState(record.logStatus);

  const contactId = record.ghlContact?.id || record.ghlContactId;

  function handleTaskCreated(taskId, assigneeId, status) {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ghlAssignee: assigneeId, taskStatus: status } : t
    ));
  }

  async function handleLog() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/ghl/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: record.emailId,
          contactId,
        }),
      });
      if (res.ok) { setLocalStatus('logged'); onRefresh(); }
    } finally { setSubmitting(false); }
  }

  async function handleIgnore() {
    await fetch('/api/ghl/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: record.emailId, action: 'ignore' }),
    });
    setLocalStatus('ignored');
    onRefresh();
  }

  const p = record.parsed;
  const isDone = localStatus === 'logged' || localStatus === 'ignored';
  const isUnmatched = record.matchStatus === 'unmatched';

  return (
    <div style={{
      background: '#fff', border: `1px solid ${isDone ? '#e5e7eb' : isUnmatched ? '#fecaca' : '#bbf7d0'}`,
      borderRadius: 10, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      opacity: isDone ? 0.75 : 1,
    }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', userSelect: 'none', background: isDone ? '#fafafa' : '#fff' }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: isUnmatched ? '#fee2e2' : '#dcfce7',
          border: `2px solid ${isUnmatched ? '#fca5a5' : '#86efac'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isUnmatched ? '#dc2626' : '#16a34a',
          fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>
          {(p.contactName?.[0] || '?').toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>
              {record.ghlContact ? `${record.ghlContact.firstName || ''} ${record.ghlContact.lastName || ''}`.trim() : (p.contactName || 'Unknown Contact')}
            </span>
            {p.contactPhone && <span style={{ color: '#6b7280', fontSize: 13 }}>{formatPhone(p.contactPhone)}</span>}
            <Badge status={record.matchStatus} />
            <Badge status={localStatus} />
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            {p.callDateTime} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {record.ghlContact && <span style={{ color: '#16a34a', marginLeft: 8 }}>→ {record.ghlContact.firstName} {record.ghlContact.lastName}</span>}
          </div>
        </div>

        <span style={{ color: '#9ca3af', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
          {p.summary && p.summary.length > 5 && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginTop: 14, marginBottom: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Summary</p>
              <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{p.summary}</p>
            </div>
          )}

          {p.recap && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Recap</p>
              <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{p.recap}</p>
            </div>
          )}

          {tasks.length > 0 && !isDone && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.08em' }}>
                Tasks — Assign individually before logging
              </p>
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  users={users}
                  contactId={contactId}
                  emailId={record.emailId}
                  onTaskCreated={handleTaskCreated}
                />
              ))}
            </div>
          )}

          {record.matchStatus === 'unmatched' && !isDone && (
            <ContactSearchPanel record={{ ...record, tasks }} users={users} onResolved={(id, status) => { setLocalStatus(status); onRefresh(); }} />
          )}

          {record.matchStatus === 'matched' && !isDone && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={handleLog} disabled={submitting} style={{ padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                {submitting ? 'Logging...' : '✓ Log to GHL'}
              </button>
              <button onClick={handleIgnore} style={{ padding: '10px 22px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
                Ignore
              </button>
            </div>
          )}

          {isDone && (
            <p style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic', marginTop: 12 }}>
              {localStatus === 'logged'
                ? record.autoLogged
                  ? '⚡ Auto-logged to GoHighLevel'
                  : '✓ Successfully logged to GoHighLevel'
                : '✗ Ignored'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [lastPoll, setLastPoll] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchRecords = useCallback(async () => {
    const res = await fetch('/api/records');
    const data = await res.json();
    const recs = data.records;
    setRecords(Array.isArray(recs) ? recs : []);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [r, u] = await Promise.all([fetch('/api/records'), fetch('/api/ghl/users')]);
      const rd = await r.json();
      const ud = await u.json();
      const recs = rd.records;
      setRecords(Array.isArray(recs) ? recs : []);
      setUsers(Array.isArray(ud.users) ? ud.users : []);
      setLoading(false);
    }
    init();
  }, []);

  async function triggerEnrich() {
    setEnriching(true);
    try {
      await fetch('/api/enrich', { method: 'POST' });
      await fetchRecords();
    } finally { setEnriching(false); }
  }

  async function triggerPoll() {
    setPolling(true);
    try {
      const res = await fetch('/api/poll');
      const data = await res.json();
      setLastPoll(data);
      await fetchRecords();
    } finally { setPolling(false); }
  }

  const counts = {
    all: records.filter(r => r.logStatus !== 'ignored').length,
    pending: records.filter(r => r.logStatus === 'pending').length,
    unmatched: records.filter(r => r.matchStatus === 'unmatched' && r.logStatus !== 'ignored').length,
    logged: records.filter(r => r.logStatus === 'logged').length,
    ignored: records.filter(r => r.logStatus === 'ignored').length,
  };

  const filtered = records.filter(r => {
    if (filter === 'ignored') return r.logStatus === 'ignored';
    // Hide ignored records from every other view
    if (r.logStatus === 'ignored') return false;
    if (filter === 'pending') return r.logStatus === 'pending';
    if (filter === 'unmatched') return r.matchStatus === 'unmatched';
    if (filter === 'logged') return r.logStatus === 'logged';
    return true;
  });

  return (
    <>
      <Head>
        <title>RingCentral → GHL Sync</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', sans-serif", color: '#111827' }}>
        {/* Nav */}
        <div style={{ borderBottom: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #2563eb, #16a34a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📞</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>RingCentral → GHL</div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>Call Notes Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastPoll && <span style={{ color: '#9ca3af', fontSize: 12 }}>Last poll: {lastPoll.newRecords} new · {lastPoll.emailsChecked} checked</span>}
            <button onClick={triggerEnrich} disabled={enriching} style={{ padding: '8px 18px', background: enriching ? '#e5e7eb' : '#f59e0b', color: enriching ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, cursor: enriching ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, marginRight: 8 }}>
              {enriching ? '⟳ Enriching...' : '🔍 Find Matches'}
            </button>
            <button onClick={triggerPoll} disabled={polling} style={{ padding: '8px 18px', background: polling ? '#e5e7eb' : '#2563eb', color: polling ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, cursor: polling ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
              {polling ? '⟳ Polling...' : '⟳ Poll Now'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', color: '#6b7280' },
              { key: 'pending', label: 'Pending', color: '#d97706' },
              { key: 'unmatched', label: 'No Match', color: '#dc2626' },
              { key: 'logged', label: 'Logged', color: '#16a34a' },
              { key: 'ignored', label: 'Ignored', color: '#9ca3af' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '7px 16px', borderRadius: 20,
                background: filter === f.key ? '#fff' : 'transparent',
                border: `1px solid ${filter === f.key ? f.color : '#e5e7eb'}`,
                color: filter === f.key ? f.color : '#9ca3af',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                boxShadow: filter === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                {f.label} <span style={{ background: '#f3f4f6', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 80 }}>Loading call notes...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 80, border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fff' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={{ fontSize: 16, marginBottom: 8, color: '#374151' }}>No call notes found</p>
              <p style={{ fontSize: 13 }}>{records.length === 0 ? 'Click "Poll Now" to check Ashley\'s inbox.' : `No records match the "${filter}" filter.`}</p>
              {records.length === 0 && <button onClick={triggerPoll} style={{ marginTop: 20, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Poll Now</button>}
            </div>
          ) : (
            filtered.map(record => <CallNoteCard key={record.emailId} record={record} users={users} onRefresh={fetchRecords} />)
          )}
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', background: '#fff' }}>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>ashley@gofedretire.com → GoHighLevel · {counts.all} records</span>
          <a href="/api/auth/login" style={{ color: '#2563eb', fontSize: 12, textDecoration: 'none' }}>Re-authorize Outlook</a>
        </div>
      </div>
    </>
  );
}