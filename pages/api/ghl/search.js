// pages/api/ghl/search.js
import { searchContacts } from '../../../lib/ghl';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const contacts = await searchContacts(q);
    return res.status(200).json({ contacts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
