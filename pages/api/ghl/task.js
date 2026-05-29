// pages/api/ghl/task.js
// Creates a single task in GHL immediately when assigned

import { createTask } from '../../../lib/ghl';
import { getRecord, updateRecord } from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { emailId, taskId, assignedTo, contactId } = req.body;

  if (!emailId || !taskId || !assignedTo || !contactId) {
    return res.status(400).json({ error: 'emailId, taskId, assignedTo, contactId required' });
  }

  try {
    const record = getRecord(emailId);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const task = record.tasks.find(t => t.id === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await createTask({
      contactId,
      title: task.description,
      assignedTo,
    });

    // Update task status in store
    updateRecord(emailId, {
      tasks: record.tasks.map(t =>
        t.id === taskId
          ? { ...t, ghlAssignee: assignedTo, taskStatus: 'created' }
          : t
      ),
    });

    return res.status(200).json({ success: true, taskId });
  } catch (err) {
    console.error('Task error:', err);
    return res.status(500).json({ error: err.message });
  }
}