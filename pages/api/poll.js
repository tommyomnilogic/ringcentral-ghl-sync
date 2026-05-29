// pages/api/poll.js
import { getAccessToken } from '../../lib/msAuth';
import { parseRingCentralEmail } from '../../lib/parseEmail';
import { searchContactByPhone, searchContactsByName, addNoteToContact, checkNoteAlreadyLogged } from '../../lib/ghl';
import { addRecord, getProcessedIds, updateRecord } from '../../lib/store';
import { moveEmailToProcessed } from '../../lib/msEmail';
import { searchRCContactByPhone } from '../../lib/rcContacts';
import { lookupCNAM } from '../../lib/cnam';
import { searchOutlookContactByPhone } from '../../lib/outlookContacts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const CALL_NOTES_FOLDER_ID = 'AAMkAGZhMzkyMDQzLThiYTQtNDI4OC1hODc2LTUzMDkxM2I4ODM4MAAuAAAAAABDZqlrUdd5S7QyDmWt04GxAQBNHk7ZXZzoR7XLxpjZ8cOWAAAREdxNAAA=';

async function getEmails(accessToken) {
  const url = `${GRAPH_BASE}/me/mailFolders/${CALL_NOTES_FOLDER_ID}/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,body,receivedDateTime,from`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Failed to fetch emails: ${await res.text()}`);
  return (await res.json()).value || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAccessToken();
    const processedIds = await getProcessedIds();
    const emails = await getEmails(accessToken);

    let newCount = 0;
    let autoLoggedCount = 0;

    for (const email of emails) {
      if (processedIds.includes(email.id)) continue;

      const subject = email.subject || '';
      if (!subject.toLowerCase().includes('notes of your call')) continue;

      const parsed = parseRingCentralEmail(email.body?.content || '', subject);

      let ghlContact = null;
      let matchStatus = 'unmatched';
      let contactSuggestions = [];
      let ghlPossibleMatches = [];

      if (parsed.contactPhone) {
        const { exact, possible } = await searchContactByPhone(parsed.contactPhone);
        if (exact) {
          ghlContact = exact;
          matchStatus = 'matched';
          ghlPossibleMatches = possible;
        } else if (possible.length > 0) {
          // Phone matches but let user confirm
          ghlPossibleMatches = possible;
          matchStatus = 'unmatched';
        }
      }

      // Also search by name if we have one and still unmatched
      if (matchStatus === 'unmatched' && parsed.contactName) {
        const nameMatches = await searchContactsByName(parsed.contactName);
        ghlPossibleMatches = [...ghlPossibleMatches, ...nameMatches.filter(c => !ghlPossibleMatches.find(p => p.id === c.id))];
      }

      // CNAM lookup for unmatched records without a name
      if (matchStatus === 'unmatched' && parsed.contactPhone && !parsed.contactName) {
        cnamResult = await lookupCNAM(parsed.contactPhone);
        if (cnamResult?.name) {
          const cnamMatches = await searchContactsByName(cnamResult.name).catch(() => []);
          const newMatches = cnamMatches.filter(c => !ghlPossibleMatches.find(p => p.id === c.id));
          ghlPossibleMatches = [...ghlPossibleMatches, ...newMatches];
        }
      }

      // For unmatched, search Outlook and RingCentral
      if (matchStatus === 'unmatched' && parsed.contactPhone) {
        const [outlookMatch, rcMatch] = await Promise.all([
          searchOutlookContactByPhone(parsed.contactPhone),
          searchRCContactByPhone(parsed.contactPhone),
        ]);
        if (outlookMatch) contactSuggestions.push(outlookMatch);
        if (rcMatch && (!outlookMatch || rcMatch.name !== outlookMatch.name)) {
          contactSuggestions.push(rcMatch);
        }
      }

      const record = {
        emailId: email.id,
        receivedAt: email.receivedDateTime,
        subject,
        parsed,
        ghlContact: ghlContact || null,
        matchStatus,
        logStatus: 'pending',
        contactSuggestions,
        ghlPossibleMatches,
        cnamResult,
        tasks: parsed.tasks.map((t, i) => ({
          ...t,
          id: `${email.id}-task-${i}`,
          ghlAssignee: null,
          taskStatus: 'pending',
        })),
      };

      if (matchStatus === 'matched' && ghlContact?.id) {
        const alreadyLogged = await checkNoteAlreadyLogged(ghlContact.id, parsed.callDateTime);

        if (alreadyLogged) {
          record.logStatus = 'logged';
          record.skipReason = 'already_logged';
          await addRecord(record);
          try { await moveEmailToProcessed(email.id); } catch (e) { console.error('Move error:', e.message); }
        } else {
          try {
            await addNoteToContact(ghlContact.id, parsed.fullNote);
            record.logStatus = 'logged';
            record.autoLogged = true;
            await addRecord(record);
            await updateRecord(email.id, { logStatus: 'logged', ghlContactId: ghlContact.id, autoLogged: true });
            try {
              await moveEmailToProcessed(email.id);
              await updateRecord(email.id, { emailMoved: true });
            } catch (moveErr) { console.error('Move error:', moveErr.message); }
            autoLoggedCount++;
          } catch (logErr) {
            console.error('Auto-log error:', logErr.message);
            record.logStatus = 'pending';
            await addRecord(record);
          }
        }
      } else {
        await addRecord(record);
      }

      newCount++;
    }

    return res.status(200).json({ success: true, emailsChecked: emails.length, newRecords: newCount, autoLogged: autoLoggedCount });
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}