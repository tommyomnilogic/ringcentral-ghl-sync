// lib/ghl.js
// GoHighLevel API helper functions

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID || '7ZVXNPvaTTHCO2wcpdnk';

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

function formatPhone(digits) {
  // Try multiple formats GHL might store
  const d = digits.replace(/\D/g, '');
  const last10 = d.slice(-10);
  return [
    d,
    last10,
    `+1${last10}`,
    `1${last10}`,
    `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`,
    `${last10.slice(0,3)}-${last10.slice(3,6)}-${last10.slice(6)}`,
    `${last10.slice(0,3)}.${last10.slice(3,6)}.${last10.slice(6)}`,
  ];
}

// ── Check all phone fields on a contact ─────────────────────────────────────
function contactHasPhone(contact, last10) {
  // Check primary phone
  if ((contact.phone || '').replace(/\D/g, '').slice(-10) === last10) return true;
  // Check additional phones array
  const phones = contact.additionalPhones || contact.phones || [];
  return phones.some(p => {
    const num = typeof p === 'string' ? p : (p.phone || p.number || '');
    return num.replace(/\D/g, '').slice(-10) === last10;
  });
}

// ── Search contacts by phone number ─────────────────────────────────────────
// Returns { exact: contact|null, possible: contact[] }
export async function searchContactByPhone(phone) {
  if (!phone) return { exact: null, possible: [] };
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  const queriesToTry = [
    `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`,
    `+1${last10}`,
    last10,
  ];

  for (const q of queriesToTry) {
    const url = `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(q)}&limit=20`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) continue;
    const data = await res.json();
    const contacts = data?.contacts || [];

    // Check ALL phone fields including additional phones
    const phoneMatches = contacts.filter(c => contactHasPhone(c, last10));
    if (phoneMatches.length > 0) {
      return { exact: phoneMatches[0], possible: phoneMatches };
    }

    // If no exact match, return all results as possible matches for user review
    if (contacts.length > 0) {
      return { exact: null, possible: contacts.slice(0, 5) };
    }
  }

  return { exact: null, possible: [] };
}

// ── Get full contact details including additional phones ────────────────────
export async function getContactById(contactId) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.contact || data;
}

// ── Search contacts by name ──────────────────────────────────────────────────
export async function searchContactsByName(name) {
  if (!name) return [];
  const url = `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(name)}&limit=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  return (await res.json())?.contacts || [];
}

// ── Search contacts by name or phone (for dashboard search) ─────────────────
export async function searchContacts(query) {
  const digits = query.replace(/\D/g, '');
  const isPhone = digits.length >= 7;

  const url = isPhone
    ? `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(digits.slice(-10))}&limit=20`
    : `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(query)}&limit=20`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.error('GHL search failed', res.status, await res.text());
    return [];
  }
  const contacts = (await res.json())?.contacts || [];

  if (isPhone) {
    const last10 = digits.slice(-10);
    return contacts.filter(c => {
      const cPhone = (c.phone || '').replace(/\D/g, '');
      return cPhone.slice(-10) === last10;
    });
  }
  return contacts;
}

// ── Create a new contact ─────────────────────────────────────────────────────
export async function createContact({ name, phone }) {
  const parts = (name || '').trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  const digits = (phone || '').replace(/\D/g, '');

  const body = {
    locationId: LOCATION_ID,
    firstName,
    lastName,
    phone: `+1${digits.slice(-10)}`,
    source: 'RingCentral Call Notes',
  };

  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create contact: ${err}`);
  }

  const data = await res.json();
  return data?.contact || data;
}

// ── Check if a note has already been logged for this call ──────────────────
export async function checkNoteAlreadyLogged(contactId, callDateTime) {
  if (!contactId || !callDateTime) return false;

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/notes?limit=50`, {
    headers: headers(),
  });

  if (!res.ok) return false;

  const data = await res.json();
  const notes = data?.notes || [];

  // Check if any existing note contains the call datetime
  return notes.some(n => (n.body || '').includes(callDateTime));
}

// ── Add a note to a contact ──────────────────────────────────────────────────
export async function addNoteToContact(contactId, noteBody) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ body: noteBody }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add note: ${err}`);
  }

  return await res.json();
}

// ── Create a task on a contact ───────────────────────────────────────────────
export async function createTask({ contactId, title, assignedTo, dueDate }) {
  const due = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    title,
    body: title,
    assignedTo: assignedTo || null,
    dueDate: due,
    completed: false,
  };

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tasks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create task: ${err}`);
  }

  return await res.json();
}

// ── Get all users in the location ───────────────────────────────────────────
export async function getLocationUsers() {
  const res = await fetch(`${GHL_BASE}/users/?locationId=${LOCATION_ID}`, {
    headers: headers(),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data?.users || [];
}