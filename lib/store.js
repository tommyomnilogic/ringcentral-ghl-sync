// lib/store.js
// Persistent store using Upstash Redis REST API

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

async function redisGet(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result === null || data.result === undefined) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch (e) {
    console.error('Redis get error:', e.message);
    return null;
  }
}

async function redisSet(key, value) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    // Upstash REST API: POST /set/key with body being the value as a JSON string
    const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
      method: 'GET', // Upstash supports GET for simple set operations
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!res.ok) {
      // Fallback to POST method
      await fetch(`${REDIS_URL}/set`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value: JSON.stringify(value) }),
      });
    }
  } catch (e) {
    console.error('Redis set error:', e.message);
  }
}

export async function getAllRecords() {
  const data = await redisGet('callnotes:records');
  return Array.isArray(data) ? data : [];
}

export async function getProcessedIds() {
  const data = await redisGet('callnotes:processedIds');
  return Array.isArray(data) ? data : [];
}

export async function addRecord(record) {
  const [records, processedIds] = await Promise.all([
    getAllRecords(),
    getProcessedIds(),
  ]);

  if (processedIds.includes(record.emailId)) return;

  const newRecords = [record, ...records];
  const newIds = [...processedIds, record.emailId];

  await Promise.all([
    redisSet('callnotes:records', newRecords),
    redisSet('callnotes:processedIds', newIds),
  ]);
}

export async function updateRecord(emailId, updates) {
  const records = await getAllRecords();
  const idx = records.findIndex(r => r.emailId === emailId);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...updates };
  await redisSet('callnotes:records', records);
  return records[idx];
}

export async function getRecord(emailId) {
  const records = await getAllRecords();
  return records.find(r => r.emailId === emailId) || null;
}