// lib/cnam.js
// CNAM caller name lookup via AbstractAPI Phone Intelligence

export async function lookupCNAM(phone) {
  if (!phone || !process.env.ABSTRACT_API_KEY) return null;
  
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;

  try {
    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY}&phone=1${digits}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();

    // AbstractAPI returns format, validity, country, location, carrier, line_type
    if (!data.valid) return null;

    return {
      name: data.name || null,
      carrier: data.carrier || null,
      lineType: data.line_type || null,
      location: data.location || null,
      source: 'CNAM',
      phone: digits,
    };
  } catch (err) {
    console.error('CNAM lookup error:', err.message);
    return null;
  }
}