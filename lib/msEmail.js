// lib/msEmail.js
// Microsoft Graph email operations - move emails between folders

import { getAccessToken } from './msAuth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const PROCESSED_FOLDER_NAME = 'Call notes - processed';

// ── Get or create the "Call notes - processed" folder ───────────────────────
export async function getOrCreateProcessedFolder(accessToken) {
  // Find Inbox first
  const foldersRes = await fetch(`${GRAPH_BASE}/me/mailFolders?$top=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const foldersData = await foldersRes.json();
  const inbox = (foldersData.value || []).find(f => f.displayName.toLowerCase() === 'inbox');
  if (!inbox) throw new Error('Inbox not found');

  // Check if processed folder already exists
  const subRes = await fetch(`${GRAPH_BASE}/me/mailFolders/${inbox.id}/childFolders?$top=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const subData = await subRes.json();
  const existing = (subData.value || []).find(f =>
    f.displayName.toLowerCase() === PROCESSED_FOLDER_NAME.toLowerCase()
  );
  if (existing) return existing.id;

  // Create it
  const createRes = await fetch(`${GRAPH_BASE}/me/mailFolders/${inbox.id}/childFolders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: PROCESSED_FOLDER_NAME }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create processed folder: ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

// ── Move an email to the processed folder ───────────────────────────────────
export async function moveEmailToProcessed(emailId) {
  const accessToken = await getAccessToken();
  const folderId = await getOrCreateProcessedFolder(accessToken);

  const res = await fetch(`${GRAPH_BASE}/me/messages/${emailId}/move`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationId: folderId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to move email: ${err}`);
  }

  return await res.json();
}