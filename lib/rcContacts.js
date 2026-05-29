// lib/rcContacts.js
// RingCentral contact lookup by phone number using JWT auth

const RC_BASE = 'https://platform.ringcentral.com';

let rcToken = null;
let rcTokenExpiry = 0;

async function getRCAccessToken() {
  if (rcToken && Date.now() < rcTokenExpiry - 60000) return rcToken;

  const res = await fetch(`${RC_BASE}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: process.env.RC_JWT_TOKEN,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RC auth failed: ${err}`);
  }

  const data = await res.json();
  rcToken = data.access_token;
  rcTokenExpiry = Date.now() + data.expires_in * 1000;
  return rcToken;
}

export async function searchRCContactByPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '').slice(-10);

  try {
    const token = await getRCAccessToken();

    // Search company directory contacts
    const res = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/directory/contacts?phoneNumber=${encodeURIComponent(digits)}&perPage=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      const records = data?.records || [];
      const match = records.find(c => {
        const phones = c.phoneNumbers || [];
        return phones.some(p => (p.phoneNumber || '').replace(/\D/g, '').slice(-10) === digits);
      });
      if (match) {
        return {
          name: `${match.firstName || ''} ${match.lastName || ''}`.trim(),
          firstName: match.firstName,
          lastName: match.lastName,
          phone: digits,
          source: 'RingCentral',
          email: match.email || null,
        };
      }
    }

    // Also search personal contacts
    const personalRes = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/extension/~/address-book/contact?phoneNumber=${encodeURIComponent(digits)}&perPage=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (personalRes.ok) {
      const personalData = await personalRes.json();
      const personalRecords = personalData?.records || [];
      const personalMatch = personalRecords.find(c => {
        const phones = [
          c.homePhone, c.businessPhone, c.mobilePhone,
          c.homePhone2, c.businessPhone2, c.mobilePhone2,
        ].filter(Boolean);
        return phones.some(p => p.replace(/\D/g, '').slice(-10) === digits);
      });

      if (personalMatch) {
        return {
          name: `${personalMatch.firstName || ''} ${personalMatch.lastName || ''}`.trim(),
          firstName: personalMatch.firstName,
          lastName: personalMatch.lastName,
          phone: digits,
          source: 'RingCentral',
          email: personalMatch.email || null,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('RC contact lookup error:', err.message);
    return null;
  }
}