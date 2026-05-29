// pages/api/ghl/log.js
// Logs a call note and tasks to a GHL contact, then moves email to processed folder

import { addNoteToContact, createTask, createContact } from '../../../lib/ghl';
import { updateRecord, getRecord } from '../../../lib/store';
import { moveEmailToProcessed } from '../../../lib/msEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { emailId, contactId, action, tasks, createNew, contactName, contactPhone } = req.body;

  if (!emailId) return res.status(400).json({ error: 'emailId required' });

  try {
    const record = getRecord(emailId);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    // Handle ignore — just mark it, don't move the email
    if (action === 'ignore') {
      updateRecord(emailId, { logStatus: 'ignored' });
      return res.status(200).json({ success: true, action: 'ignored' });
    }

    let resolvedContactId = contactId;

    // Create new contact if requested
    if (createNew) {
      const newContact = await createContact({
        name: contactName || record.parsed.contactName,
        phone: contactPhone || record.parsed.contactPhone,
      });
      resolvedContactId = newContact.id;
      updateRecord(emailId, {
        ghlContact: newContact,
        matchStatus: 'matched',
      });
    }

    if (!resolvedContactId) {
      return res.status(400).json({ error: 'No contact ID provided' });
    }

    // Log the full note to GHL
    await addNoteToContact(resolvedContactId, record.parsed.fullNote);

    // Create tasks that have been assigned
    const taskResults = [];
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        if (task.ghlAssignee === 'ignore' || !task.ghlAssignee) continue;
        try {
          await createTask({
            contactId: resolvedContactId,
            title: task.description,
            assignedTo: task.ghlAssignee,
          });
          taskResults.push({ id: task.id, status: 'created' });
        } catch (taskErr) {
          console.error('Task creation error:', taskErr);
          taskResults.push({ id: task.id, status: 'error', error: taskErr.message });
        }
      }
    }

    // Move email to "Call notes - processed" folder to prevent re-processing
    let emailMoved = false;
    try {
      await moveEmailToProcessed(emailId);
      emailMoved = true;
      console.log(`Moved email ${emailId} to processed folder`);
    } catch (moveErr) {
      // Non-fatal — log the error but don't fail the whole operation
      console.error('Email move error:', moveErr.message);
    }

    // Update record status
    updateRecord(emailId, {
      logStatus: 'logged',
      ghlContactId: resolvedContactId,
      emailMoved,
      tasks: record.tasks.map(t => {
        const result = taskResults.find(r => r.id === t.id);
        return result ? { ...t, taskStatus: result.status } : t;
      }),
    });

    return res.status(200).json({
      success: true,
      contactId: resolvedContactId,
      tasksCreated: taskResults.filter(t => t.status === 'created').length,
      emailMoved,
    });
  } catch (err) {
    console.error('Log error:', err);
    return res.status(500).json({ error: err.message });
  }
}