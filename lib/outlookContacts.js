// lib/outlookContacts.js
// Outlook contact lookup by phone number using Microsoft Graph

import { getAccessToken } from './msAuth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export async function searchOutlookContactByPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '').slice(-10);

  try {
    const token = await getAccessToken();

    // Search Outlook contacts by phone
    const res = await fetch(
      `${GRAPH_BASE}/me/contacts?$filter=phones/any(p: contains(p/number, '${digits}'))&$select=displayName,givenName,surname,emailAddresses,phones&$top=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      const contacts = data?.value || [];
      const match = contacts.find(c => {
        const phones = (c.phones || []).map(p => (p.number || '').replace(/\D/g, '').slice(-10));
        return phones.includes(digits);
      });

      if (match) {
        return {
          name: match.displayName || `${match.givenName || ''} ${match.surname || ''}`.trim(),
          firstName: match.givenName,
          lastName: match.surname,
          phone: digits,
          source: 'Outlook',
          email: match.emailAddresses?.[0]?.address || null,
        };
      }
    }

    // Fallback: search by display name containing digits
    const searchRes = await fetch(
      `${GRAPH_BASE}/me/contacts?$search="${digits}"&$select=displayName,givenName,surname,emailAddresses,phones&$top=10`,
      { headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const searchContacts = searchData?.value || [];
      const searchMatch = searchContacts.find(c => {
        const phones = (c.phones || []).map(p => (p.number || '').replace(/\D/g, '').slice(-10));
        return phones.includes(digits);
      });

      if (searchMatch) {
        return {
          name: searchMatch.displayName || `${searchMatch.givenName || ''} ${searchMatch.surname || ''}`.trim(),
          firstName: searchMatch.givenName,
          lastName: searchMatch.surname,
          phone: digits,
          source: 'Outlook',
          email: searchMatch.emailAddresses?.[0]?.address || null,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Outlook contact lookup error:', err.message);
    return null;
  }
}