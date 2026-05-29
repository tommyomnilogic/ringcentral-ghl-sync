// lib/cnam.js
// CNAM caller name lookup via NumLookupAPI

export async function lookupCNAM(phone) {
  if (!phone || !process.env.NUMLOOKUP_API_KEY) return null;
  
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;

  try {
    const url = `https://api.numlookupapi.com/v1/info/+1${digits}?apikey=${process.env.NUMLOOKUP_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('NumLookup error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const callerName = data.caller_name?.caller_name || data.name || null;

    return {
      name: callerName,
      source: 'CNAM',
      phone: digits,
    };
  } catch (err) {
    console.error('CNAM lookup error:', err.message);
    return null;
  }
}

// ── Extract first name mentioned in call summary/recap ───────────────────────
export function extractNameFromSummary(summary, recap) {
  const text = `${summary || ''} ${recap || ''}`;
  
  const patterns = [
    /(?:called|contact(?:ed)?|spoke with|meeting with|appointment with|discuss(?:ed)? with|confirmed with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(?:Ashley|Tom|Drew|Jacob)\s+(?:called|spoke|discussed|confirmed|met)\s+(?:with\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  ];

  const skipNames = new Set(['Ashley', 'Phelan', 'Tom', 'Jacob', 'Drew', 'Federal', 'Eastern', 'Social', 'Medicare', 'Roth', 'TSP', 'Blue', 'Cross', 'Shield']);

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      const firstName = name.split(' ')[0];
      if (!skipNames.has(firstName) && firstName.length > 2) {
        return name;
      }
    }
  }

  return null;
}