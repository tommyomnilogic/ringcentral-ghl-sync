// pages/api/records.js
// Returns all call note records for the dashboard

import { getAllRecords } from '../../lib/store';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const records = getAllRecords();
  return res.status(200).json({ records });
}
