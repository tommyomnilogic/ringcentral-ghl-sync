// pages/api/enrich.js
// Re-enriches existing unmatched records with GHL possible matches,
// Outlook/RingCentral suggestions, and CNAM caller name lookup

import { searchContactByPhone, searchContactsByName } from '../../lib/ghl';
import { searchRCContactByPhone } from '../../lib/rcContacts';
import { searchOutlookContactByPhone } from '../../lib/outlookContacts';
import { lookupCNAM } from '../../lib/cnam';
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
      let cnamResult = null;

      // Always re-run all lookups for unmatched records
      if (phone) {
        const { possible } = await searchContactByPhone(phone);
        if (possible.length > 0) ghlPossibleMatches = [...possible];
      }

      if (name && ghlPossibleMatches.length === 0) {
        const nameMatches = await searchContactsByName(name);
        if (nameMatches.length > 0) ghlPossibleMatches = [...nameMatches];
      }

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

      // CNAM lookup for all unmatched records
      if (phone) {
        cnamResult = await lookupCNAM(phone);
        if (cnamResult?.name && ghlPossibleMatches.length === 0) {
          const cnamNameMatches = await searchContactsByName(cnamResult.name);
          if (cnamNameMatches.length > 0) ghlPossibleMatches = [...cnamNameMatches];
        }
      }

      // Always update the record with fresh lookup results
      await updateRecord(record.emailId, {
        ghlPossibleMatches,
        contactSuggestions,
        cnamResult,
      });
      enrichedCount++;
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