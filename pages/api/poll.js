// pages/api/poll.js
// Polls Ashley's Outlook "Call Notes" folder for new RingCentral emails
// Called every 5 minutes by Vercel Cron

import { getAccessToken } from '../../lib/msAuth';
import { parseRingCentralEmail } from '../../lib/parseEmail';
import { searchContactByPhone } from '../../lib/ghl';
import { addRecord, getProcessedIds } from '../../lib/store';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function findCallNotesFolder(accessToken) {
  // Get all mail folders
  const res = await fetch(`${GRAPH_BASE}/me/mailFolders?$top=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch mail folders');
  const data = await res.json();

  // Find "Call notes" folder (case-insensitive)
  const folder = data.value?.find(f =>
    f.displayName.toLowerCase().includes('call note') ||
    f.displayName.toLowerCase().includes('callnote')
  );

  return folder?.id || null;
}

async function getEmails(accessToken, folderId) {
  const url = folderId
    ? `${GRAPH_BASE}/me/mailFolders/${folderId}/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,body,receivedDateTime,from`
    : `${GRAPH_BASE}/me/messages?$top=20&$filter=from/emailAddress/address eq 'no-reply@ringcentral.com'&$select=id,subject,body,receivedDateTime,from`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch emails: ${err}`);
  }

  const data = await res.json();
  return data.value || [];
}

export default async function handler(req, res) {
  // Allow manual trigger via GET, or Vercel Cron via GET with header
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAccessToken();
    const processedIds = getProcessedIds();

    // Find the Call Notes folder
    const folderId = await findCallNotesFolder(accessToken);
    console.log(`Call Notes folder ID: ${folderId || 'not found, using filter'}`);

    // Fetch emails
    const emails = await getEmails(accessToken, folderId);
    console.log(`Found ${emails.length} emails in Call Notes folder`);

    let newCount = 0;

    for (const email of emails) {
      // Skip already processed
      if (processedIds.includes(email.id)) continue;

      // Only process RingCentral call note emails
      const subject = email.subject || '';
      if (!subject.toLowerCase().includes('notes of your call')) continue;

      // Parse the email
      const parsed = parseRingCentralEmail(
        email.body?.content || '',
        subject
      );

      // Try to match contact in GHL
      let ghlContact = null;
      let matchStatus = 'unmatched';

      if (parsed.contactPhone) {
        ghlContact = await searchContactByPhone(parsed.contactPhone);
        if (ghlContact) {
          matchStatus = 'matched';
        }
      }

      // Store the record for dashboard
      const record = {
        emailId: email.id,
        receivedAt: email.receivedDateTime,
        subject,
        parsed,
        ghlContact: ghlContact || null,
        matchStatus, // 'matched' | 'unmatched'
        logStatus: 'pending', // 'pending' | 'logged' | 'ignored'
        tasks: parsed.tasks.map((t, i) => ({
          ...t,
          id: `${email.id}-task-${i}`,
          ghlAssignee: null,
          taskStatus: 'pending', // 'pending' | 'created' | 'ignored'
        })),
      };

      addRecord(record);
      newCount++;
      console.log(`Added record for: ${parsed.contactName} (${matchStatus})`);
    }

    return res.status(200).json({
      success: true,
      emailsChecked: emails.length,
      newRecords: newCount,
    });
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}
