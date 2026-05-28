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

// ── Search contacts by phone number ─────────────────────────────────────────
export async function searchContactByPhone(phone) {
  // Normalize: digits only
  const digits = phone.replace(/\D/g, '');

  const url = `${GHL_BASE}/contacts/search?locationId=${LOCATION_ID}&query=${encodeURIComponent(digits)}&limit=5`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return null;

  const data = await res.json();
  const contacts = data?.contacts || [];

  // Try to find exact phone match
  const match = contacts.find(c => {
    const cPhone = (c.phone || '').replace(/\D/g, '');
    return cPhone === digits || cPhone.endsWith(digits) || digits.endsWith(cPhone);
  });

  return match || null;
}

// ── Search contacts by name or phone (for dashboard search) ─────────────────
export async function searchContacts(query) {
  const url = `${GHL_BASE}/contacts/search?locationId=${LOCATION_ID}&query=${encodeURIComponent(query)}&limit=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.contacts || [];
}

// ── Create a new contact ─────────────────────────────────────────────────────
export async function createContact({ name, phone }) {
  const [firstName, ...rest] = (name || '').split(' ');
  const lastName = rest.join(' ');

  const body = {
    locationId: LOCATION_ID,
    firstName,
    lastName,
    phone: `+1${phone.replace(/\D/g, '')}`,
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

// ── Add a note to a contact ──────────────────────────────────────────────────
export async function addNoteToContact(contactId, noteBody) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      body: noteBody,
      userId: null,
    }),
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
    contactId,
    assignedTo: assignedTo || null,
    dueDate: due,
    status: 'incompleted',
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
