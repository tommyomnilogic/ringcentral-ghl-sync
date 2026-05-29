// pages/api/poll.js
// Polls Ashley's Outlook "Call Notes" folder for new RingCentral emails

import { getAccessToken } from '../../lib/msAuth';
import { parseRingCentralEmail } from '../../lib/parseEmail';
import { searchContactByPhone, addNoteToContact, checkNoteAlreadyLogged } from '../../lib/ghl';
import { addRecord, getProcessedIds, updateRecord } from '../../lib/store';
import { moveEmailToProcessed } from '../../lib/msEmail';

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

    let newCount = 0;
    let autoLoggedCount = 0;

    for (const email of emails) {
      if (processedIds.includes(email.id)) continue;

      const subject = email.subject || '';
      if (!subject.toLowerCase().includes('notes of your call')) continue;

      const parsed = parseRingCentralEmail(email.body?.content || '', subject);

      // Try to match contact in GHL by phone
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

      // Auto-log if matched and note hasn't been logged before
      if (matchStatus === 'matched' && ghlContact?.id) {
        const alreadyLogged = await checkNoteAlreadyLogged(
          ghlContact.id,
          parsed.callDateTime
        );

        if (alreadyLogged) {
          // Already in GHL — mark as logged and move email
          record.logStatus = 'logged';
          record.autoLogged = false;
          record.skipReason = 'already_logged';
          addRecord(record);
          try {
            await moveEmailToProcessed(email.id);
          } catch (e) {
            console.error('Move error:', e.message);
          }
        } else {
          // Auto-log the note to GHL
          try {
            await addNoteToContact(ghlContact.id, parsed.fullNote);
            record.logStatus = 'logged';
            record.autoLogged = true;
            addRecord(record);
            updateRecord(email.id, {
              logStatus: 'logged',
              ghlContactId: ghlContact.id,
              autoLogged: true,
            });

            // Move email to processed
            try {
              await moveEmailToProcessed(email.id);
              updateRecord(email.id, { emailMoved: true });
            } catch (moveErr) {
              console.error('Move error:', moveErr.message);
            }

            autoLoggedCount++;
            console.log(`Auto-logged: ${parsed.contactName || parsed.contactPhone} → ${ghlContact.firstName} ${ghlContact.lastName}`);
          } catch (logErr) {
            // If auto-log fails, fall through to dashboard
            console.error('Auto-log error:', logErr.message);
            record.logStatus = 'pending';
            addRecord(record);
          }
        }
      } else {
        // Unmatched — goes to dashboard for manual review
        addRecord(record);
      }

      newCount++;
    }

    return res.status(200).json({
      success: true,
      emailsChecked: emails.length,
      newRecords: newCount,
      autoLogged: autoLoggedCount,
    });
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}