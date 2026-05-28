// pages/api/ghl/users.js
import { getLocationUsers } from '../../../lib/ghl';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const users = await getLocationUsers();
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
