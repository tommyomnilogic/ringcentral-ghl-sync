// lib/store.js
// Simple JSON file store for call note records
// In production this could be replaced with a database (Vercel KV, PlanetScale, etc.)

import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join('/tmp', 'callnotes-store.json');

function readStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Store read error:', e);
  }
  return { records: [], processedIds: [] };
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Store write error:', e);
  }
}

export function getAllRecords() {
  return readStore().records;
}

export function getProcessedIds() {
  return readStore().processedIds;
}

export function addRecord(record) {
  const store = readStore();
  // Avoid duplicates by emailId
  if (!store.records.find(r => r.emailId === record.emailId)) {
    store.records.unshift(record); // newest first
    store.processedIds.push(record.emailId);
    writeStore(store);
  }
}

export function updateRecord(emailId, updates) {
  const store = readStore();
  const idx = store.records.findIndex(r => r.emailId === emailId);
  if (idx !== -1) {
    store.records[idx] = { ...store.records[idx], ...updates };
    writeStore(store);
    return store.records[idx];
  }
  return null;
}

export function getRecord(emailId) {
  return readStore().records.find(r => r.emailId === emailId) || null;
}
