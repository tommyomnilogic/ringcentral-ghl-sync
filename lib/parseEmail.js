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
  // Format 1: "Notes of your call with Jacob Scott (727) 947-1324 on ..."
  // Format 2: "Notes of your call with +17708625950 (770) 862-5950 on ..."
  // Format 3: "Notes of your call with +17279471324 +17279471324 on ..." (no name)

  let contactName = null;
  let contactPhone = null;
  let callDateTime = null;

  // Format 1: Named contact with area code in parens
  const namedMatch = subject?.match(
    /notes of your call with ([A-Za-z][A-Za-z\s]+?)\s+\((\d{3})\)\s*(\d{3})[-\s]?(\d{4})\s+on\s+(.+)/i
  );

  if (namedMatch) {
    contactName = namedMatch[1].trim();
    contactPhone = namedMatch[2] + namedMatch[3] + namedMatch[4];
    callDateTime = namedMatch[5].trim();
  }

  // Format 2: +1XXXXXXXXXX (XXX) XXX-XXXX — phone as "name", real number in parens
  if (!contactName) {
    const phoneNameMatch = subject?.match(
      /notes of your call with \+1\d{10}\s+\((\d{3})\)\s*(\d{3})[-\s]?(\d{4})\s+on\s+(.+)/i
    );
    if (phoneNameMatch) {
      contactPhone = phoneNameMatch[1] + phoneNameMatch[2] + phoneNameMatch[3];
      callDateTime = phoneNameMatch[4].trim();
      contactName = null; // unknown name
    }
  }

  // Format 3: +1XXXXXXXXXX +1XXXXXXXXXX (duplicated phone, no name)
  if (!contactPhone) {
    const dupPhoneMatch = subject?.match(
      /notes of your call with \+1(\d{10})\s+\+1\d{10}\s+on\s+(.+)/i
    );
    if (dupPhoneMatch) {
      contactPhone = dupPhoneMatch[1];
      callDateTime = dupPhoneMatch[2].trim();
      contactName = null;
    }
  }

  // ── Find key sections in plain text ─────────────────────────────────────
  const normalized = text
    .replace(/\s*Recap\s*/g, '\n__RECAP__\n')
    .replace(/\s*Tasks\s*/g, '\n__TASKS__\n');

  const recapIdx = normalized.indexOf('__RECAP__');
  const tasksIdx = normalized.indexOf('__TASKS__');

  // Summary: text between the intro line and Recap
  let summary = '';
  const introMatch = normalized.match(/at\s+\d+:\d+\s*[AP]M:\s*(.+?)(?=__RECAP__|__TASKS__|$)/i);
  if (introMatch) {
    summary = introMatch[1].trim();
  }

  // Recap: between __RECAP__ and __TASKS__
  let recap = '';
  if (recapIdx !== -1) {
    const end = tasksIdx !== -1 ? tasksIdx : normalized.length;
    recap = normalized.slice(recapIdx + 9, end).trim();
  }

  // Tasks: after __TASKS__, split into individual items
  const tasks = [];
  const FOOTER_JUNK = [
    'all rights reserved',
    'ringcentral',
    'view transcript',
    'powered by',
    'terms of use',
    'privacy policy',
    'copyright',
    'unsubscribe',
    'belmont, ca',
  ];

  if (tasksIdx !== -1) {
    const tasksText = normalized.slice(tasksIdx + 9);
    const taskLines = tasksText
      .split(/(?<=\.)\s+(?=[A-Z])/)
      .map(l => l.trim())
      .filter(l => {
        if (l.length < 15) return false;
        const lower = l.toLowerCase();
        return !FOOTER_JUNK.some(junk => lower.includes(junk));
      });

    for (const line of taskLines) {
      const nameMatch = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+|Ashley|Jacob|Tom|The (?:client|individual|caller))\s+(will|has|confirmed|agreed|offered|discussed|verified|review|send|ensure|determine|prepare|provide|contact|attend|consider|avoid)/i);
      tasks.push({
        assigneeName: nameMatch ? nameMatch[1].trim() : null,
        description: line.trim(),
        status: 'pending',
        ghlAssignee: null,
      });
    }
  }

  // ── Full note for GHL (no tasks — tasks are created separately) ────────────
  const displayName = contactName || (contactPhone ? `(${contactPhone.slice(0,3)}) ${contactPhone.slice(3,6)}-${contactPhone.slice(6)}` : 'Unknown');
  
  const fullNote = [
    `📞 Call with ${displayName} on ${callDateTime}`,
    summary ? `\nSummary:\n${summary}` : '',
    recap ? `\nRecap:\n${recap}` : '',
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