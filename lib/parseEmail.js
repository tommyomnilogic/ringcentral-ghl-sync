// lib/parseEmail.js
// Parses RingCentral AI call note emails into structured data

import * as cheerio from 'cheerio';

export function parseRingCentralEmail(htmlBody, subject) {
  const $ = cheerio.load(htmlBody || '');
  const text = $.text();

  // ── Contact info from subject line ──────────────────────────────────────
  // Subject: "Notes of your call with Jacob Scott (727) 947-1324 on 05/28/2026 7:12 AM"
  const subjectMatch = subject?.match(
    /Notes of your call with (.+?)\s*\(?([\d\s\-\(\)]+)\)?\s+on\s+([\d\/]+\s+[\d:]+\s*[AP]M)/i
  );

  let contactName = null;
  let contactPhone = null;
  let callDateTime = null;

  if (subjectMatch) {
    contactName = subjectMatch[1].trim();
    contactPhone = subjectMatch[2].replace(/\D/g, ''); // digits only
    callDateTime = subjectMatch[3].trim();
  }

  // Fallback: parse from body
  if (!contactName) {
    const bodyMatch = text.match(
      /Notes of your call with (.+?)\s*\(([\d\s\-\(\)]+)\)\s+on\s+([\w,\s]+at\s+[\d:]+\s*[AP]M)/i
    );
    if (bodyMatch) {
      contactName = bodyMatch[1].trim();
      contactPhone = bodyMatch[2].replace(/\D/g, '');
      callDateTime = bodyMatch[3].trim();
    }
  }

  // ── Summary / Recap ─────────────────────────────────────────────────────
  // Grab everything between the intro line and "Recap" heading
  let summary = '';
  const summaryMatch = text.match(/at\s+[\d:]+\s*[AP]M:\s*([\s\S]+?)(?=Recap|Tasks|↗\s*View transcript)/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  // ── Recap section ───────────────────────────────────────────────────────
  let recap = '';
  const recapMatch = text.match(/Recap\s*([\s\S]+?)(?=Tasks|↗\s*View transcript)/i);
  if (recapMatch) {
    recap = recapMatch[1].trim();
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  const tasks = [];
  const tasksMatch = text.match(/Tasks\s*([\s\S]+?)(?=↗\s*View transcript|Powered by|$)/i);
  if (tasksMatch) {
    const tasksText = tasksMatch[1].trim();
    // Split on lines that start with a name or bullet
    const lines = tasksText
      .split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 20); // skip short/empty lines

    for (const line of lines) {
      // Each task line typically starts with a person's name
      const taskMatch = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:will|has|confirmed|agreed|offered|discussed|verified|review|send|ensure|determine)\s+([\s\S]+)/i);
      if (taskMatch) {
        tasks.push({
          assigneeName: taskMatch[1].trim(),
          description: line.trim(),
          status: 'pending',
          ghlAssignee: null, // to be set in dashboard
        });
      } else if (line.length > 20) {
        tasks.push({
          assigneeName: null,
          description: line.trim(),
          status: 'pending',
          ghlAssignee: null,
        });
      }
    }
  }

  // ── Full note for GHL ───────────────────────────────────────────────────
  const fullNote = [
    `📞 Call with ${contactName} on ${callDateTime}`,
    '',
    summary ? `Summary:\n${summary}` : '',
    recap ? `Recap:\n${recap}` : '',
    tasks.length > 0
      ? `Tasks:\n${tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

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
