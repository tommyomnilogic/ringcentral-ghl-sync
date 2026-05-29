// pages/api/debug_contacts.js
const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID || '7ZVXNPvaTTHCO2wcpdnk';

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

export default async function handler(req, res) {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const digits = phone.replace(/\D/g, '').slice(-10);
  const formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;

  const results = {};

  const tests = [
    { label: 'lookup_by_phone', url: `${GHL_BASE}/contacts/lookup?locationId=${LOCATION_ID}&phone=${encodeURIComponent('+1'+digits)}` },
    { label: 'lookup_no_plus', url: `${GHL_BASE}/contacts/lookup?locationId=${LOCATION_ID}&phone=${encodeURIComponent(digits)}` },
    { label: 'contacts_phone_param', url: `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&phone=${encodeURIComponent('+1'+digits)}&limit=20` },
    { label: 'contacts_list_digits', url: `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(digits)}&limit=20` },
    { label: 'contacts_list_formatted', url: `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(formatted)}&limit=20` },
  ];

  for (const test of tests) {
    try {
      const r = await fetch(test.url, { headers: ghlHeaders() });
      const d = await r.json();
      results[test.label] = {
        status: r.status,
        count: (d?.contacts || []).length,
        contacts: (d?.contacts || []).map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          phone: c.phone,
          additionalPhones: c.additionalPhones,
        })),
        raw: Object.keys(d),
      };
    } catch (e) {
      results[test.label] = { error: e.message };
    }
  }

  return res.status(200).json({ digits, formatted, results });
}