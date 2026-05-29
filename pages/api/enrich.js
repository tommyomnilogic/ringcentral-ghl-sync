// pages/api/enrich.js
// Re-enriches existing unmatched records with GHL possible matches
// and Outlook/RingCentral suggestions

import { searchContactByPhone, searchContactsByName } from '../../lib/ghl';
import { searchRCContactByPhone } from '../../lib/rcContacts';
import { searchOutlookContactByPhone } from '../../lib/outlookContacts';
import { getAllRecords, updateRecord } from '../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  try {
    const records = await getAllRecords();
    const unmatched = records.filter(r =>
      r.matchStatus === 'unmatched' && r.logStatus === 'pending'
    );

    let enrichedCount = 0;

    for (const record of unmatched) {
      const phone = record.parsed?.contactPhone;
      const name = record.parsed?.contactName;

      let ghlPossibleMatches = [];
      let contactSuggestions = [];

      // Search GHL by phone
      if (phone) {
        const { exact, possible } = await searchContactByPhone(phone);
        if (possible.length > 0) ghlPossibleMatches = possible;
      }

      // Search GHL by name
      if (name) {
        const nameMatches = await searchContactsByName(name);
        const newMatches = nameMatches.filter(c => !ghlPossibleMatches.find(p => p.id === c.id));
        ghlPossibleMatches = [...ghlPossibleMatches, ...newMatches];
      }

      // Search Outlook and RingCentral
      if (phone) {
        const [outlookMatch, rcMatch] = await Promise.all([
          searchOutlookContactByPhone(phone),
          searchRCContactByPhone(phone),
        ]);
        if (outlookMatch) contactSuggestions.push(outlookMatch);
        if (rcMatch && (!outlookMatch || rcMatch.name !== outlookMatch.name)) {
          contactSuggestions.push(rcMatch);
        }
      }

      if (ghlPossibleMatches.length > 0 || contactSuggestions.length > 0) {
        await updateRecord(record.emailId, { ghlPossibleMatches, contactSuggestions });
        enrichedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      unmatchedChecked: unmatched.length,
      enriched: enrichedCount,
    });
  } catch (err) {
    console.error('Enrich error:', err);
    return res.status(500).json({ error: err.message });
  }
}