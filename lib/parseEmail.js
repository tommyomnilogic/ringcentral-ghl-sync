// lib/parseEmail.js
// Parses RingCentral AI call note emails into structured data

export function parseRingCentralEmail(htmlBody, subject) {
  // Strip HTML tags to get plain text
  const text = htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── Contact info from subject line ──────────────────────────────────────
  // "Notes of your call with Jacob Scott (727) 947-1324 on 05/28/2026 7:12 AM"
  let contactName = null;
  let contactPhone = null;
  let callDateTime = null;

  const subjectMatch = subject?.match(
    /notes of your call with (.+?)\s+\((\d{3})\)\s*(\d{3}[-\s]?\d{4})\s+on\s+(.+)/i
  );

  if (subjectMatch) {
    contactName = subjectMatch[1].trim();
    contactPhone = subjectMatch[2] + subjectMatch[3].replace(/\D/g, '');
    callDateTime = subjectMatch[4].trim();
  }

  // Fallback: try without parens format
  if (!contactName) {
    const m2 = subject?.match(/notes of your call with (.+?)\s+([\d\-\(\)\s]{10,})\s+on\s+(.+)/i);
    if (m2) {
      contactName = m2[1].trim();
      contactPhone = m2[2].replace(/\D/g, '').slice(-10);
      callDateTime = m2[3].trim();
    }
  }

  // ── Find key sections in plain text ─────────────────────────────────────
  // Normalize section markers
  const normalized = text
    .replace(/\s*Recap\s*/g, '\n__RECAP__\n')
    .replace(/\s*Tasks\s*/g, '\n__TASKS__\n');

  const recapIdx = normalized.indexOf('__RECAP__');
  const tasksIdx = normalized.indexOf('__TASKS__');

  // Summary: text between the intro line and Recap
  let summary = '';
  const introEnd = normalized.search(/at\s+\d+:\d+\s*[AP]M:/i);
  if (introEnd !== -1 && recapIdx !== -1) {
    summary = normalized.slice(introEnd, recapIdx)
      .replace(/^[^:]+:/, '').trim();
  }

  // Recap: between __RECAP__ and __TASKS__
  let recap = '';
  if (recapIdx !== -1) {
    const end = tasksIdx !== -1 ? tasksIdx : normalized.length;
    recap = normalized.slice(recapIdx + 9, end).trim();
  }

  // Tasks: after __TASKS__
  const tasks = [];
  if (tasksIdx !== -1) {
    const tasksText = normalized.slice(tasksIdx + 9);
    // Split on sentences that end with a period, or on name patterns
    // Each task typically: "Person Name will/has/confirmed..."
    const taskLines = tasksText
      .split(/(?<=\.)\s+(?=[A-Z])/)
      .map(l => l.trim())
      .filter(l => l.length > 15);

    for (const line of taskLines) {
      if (line.includes('View transcript') || line.includes('RingCentral') || line.includes('Copyright')) continue;
      
      const nameMatch = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+)\s+(will|has|confirmed|agreed|offered|discussed|verified|review|send|ensure|determine)/i);
      tasks.push({
        assigneeName: nameMatch ? nameMatch[1] : null,
        description: line.trim(),
        status: 'pending',
        ghlAssignee: null,
      });
    }
  }

  // ── Full note for GHL ───────────────────────────────────────────────────
  const fullNote = [
    `📞 Call with ${contactName} on ${callDateTime}`,
    '',
    summary ? `Summary:\n${summary}` : '',
    recap ? `\nRecap:\n${recap}` : '',
    tasks.length > 0
      ? `\nTasks:\n${tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');

  return {
    contactName,
    contactPhone,
    callDateTime,
    summary,
    recap,
    tasks,
    fullNote,
    rawSubject: subject,
  };
}