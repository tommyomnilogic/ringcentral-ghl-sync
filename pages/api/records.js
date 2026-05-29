// pages/api/records.js
import { getAllRecords } from '../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const records = await getAllRecords();
  return res.status(200).json({ records });
}