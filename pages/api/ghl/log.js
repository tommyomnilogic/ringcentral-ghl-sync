// pages/api/ghl/log.js
import { addNoteToContact, createContact } from '../../../lib/ghl';
import { updateRecord, getRecord } from '../../../lib/store';
import { moveEmailToProcessed } from '../../../lib/msEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { emailId, contactId, action, createNew, contactName, contactPhone } = req.body;
  if (!emailId) return res.status(400).json({ error: 'emailId required' });

  try {
    const record = await getRecord(emailId);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    if (action === 'ignore') {
      await updateRecord(emailId, { logStatus: 'ignored' });
      return res.status(200).json({ success: true, action: 'ignored' });
    }

    let resolvedContactId = contactId;

    if (createNew) {
      const newContact = await createContact({
        name: contactName || record.parsed.contactName,
        phone: contactPhone || record.parsed.contactPhone,
      });
      resolvedContactId = newContact.id;
      await updateRecord(emailId, { ghlContact: newContact, matchStatus: 'matched' });
    }

    if (!resolvedContactId) return res.status(400).json({ error: 'No contact ID provided' });

    await addNoteToContact(resolvedContactId, record.parsed.fullNote);

    let emailMoved = false;
    try {
      await moveEmailToProcessed(emailId);
      emailMoved = true;
    } catch (moveErr) {
      console.error('Email move error:', moveErr.message);
    }

    await updateRecord(emailId, { logStatus: 'logged', ghlContactId: resolvedContactId, emailMoved });

    return res.status(200).json({ success: true, contactId: resolvedContactId, emailMoved });
  } catch (err) {
    console.error('Log error:', err);
    return res.status(500).json({ error: err.message });
  }
}