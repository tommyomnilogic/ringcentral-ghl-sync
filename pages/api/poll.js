import { getAccessToken } from '../../lib/msAuth';
import { parseRingCentralEmail } from '../../lib/parseEmail';
import { searchContactByPhone } from '../../lib/ghl';
import { addRecord, getProcessedIds } from '../../lib/store';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const CALL_NOTES_FOLDER_ID = 'AAMkAGZhMzkyMDQzLThiYTQtNDI4OC1hODc2LTUzMDkxM2I4ODM4MAAuAAAAAABDZqlrUdd5S7QyDmWt04GxAQBNHk7ZXZzoR7XLxpjZ8cOWAAAREdxNAAA=';

async function getEmails(accessToken) {
  const url = `${GRAPH_BASE}/me/mailFolders/${CALL_NOTES_FOLDER_ID}/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,body,receivedDateTime,from`;
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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const accessToken = await getAccessToken();
    const processedIds = getProcessedIds();
    const emails = await getEmails(accessToken);
    console.log(`Found ${emails.length} emails in Call Notes folder`);
    let newCount = 0;
    for (const email of emails) {
      if (processedIds.includes(email.id)) continue;
      const subject = email.subject || '';
      if (!subject.toLowerCase().includes('notes of your call')) continue;
      const parsed = parseRingCentralEmail(email.body?.content || '', subject);
      let ghlContact = null;
      let matchStatus = 'unmatched';
      if (parsed.contactPhone) {
        ghlContact = await searchContactByPhone(parsed.contactPhone);
        if (ghlContact) matchStatus = 'matched';
      }
      const record = {
        emailId: email.id,
        receivedAt: email.receivedDateTime,
        subject,
        parsed,
        ghlContact: ghlContact || null,
        matchStatus,
        logStatus: 'pending',
        tasks: parsed.tasks.map((t, i) => ({
          ...t,
          id: `${email.id}-task-${i}`,
          ghlAssignee: null,
          taskStatus: 'pending',
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
      folderFound: true,
    });
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}