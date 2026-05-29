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

      let ghlPossibleMatches = record.ghlPossibleMatches || [];
      let contactSuggestions = record.contactSuggestions || [];
      let cnamResult = record.cnamResult || null;

      // Search GHL by phone
      if (phone && ghlPossibleMatches.length === 0) {
        const { possible } = await searchContactByPhone(phone);
        if (possible.length > 0) ghlPossibleMatches = possible;
      }

      // Search GHL by name
      if (name && ghlPossibleMatches.length === 0) {
        const nameMatches = await searchContactsByName(name);
        if (nameMatches.length > 0) ghlPossibleMatches = nameMatches;
      }

      // Search Outlook and RingCentral
      if (phone && contactSuggestions.length === 0) {
        const [outlookMatch, rcMatch] = await Promise.all([
          searchOutlookContactByPhone(phone),
          searchRCContactByPhone(phone),
        ]);
        if (outlookMatch) contactSuggestions.push(outlookMatch);
        if (rcMatch && (!outlookMatch || rcMatch.name !== outlookMatch.name)) {
          contactSuggestions.push(rcMatch);
        }
      }

      // CNAM lookup if no name found yet
      if (phone && !cnamResult && !name) {
        cnamResult = await lookupCNAM(phone);
        if (cnamResult?.name) {
          // Also try GHL search with CNAM name
          const cnamNameMatches = await searchContactsByName(cnamResult.name);
          const newMatches = cnamNameMatches.filter(c => !ghlPossibleMatches.find(p => p.id === c.id));
          ghlPossibleMatches = [...ghlPossibleMatches, ...newMatches];
        }
      }

      const hasNewData = ghlPossibleMatches.length > 0 || contactSuggestions.length > 0 || cnamResult;

      if (hasNewData) {
        await updateRecord(record.emailId, {
          ghlPossibleMatches,
          contactSuggestions,
          cnamResult,
        });
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