// pages/api/debug_cnam.js
export default async function handler(req, res) {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const digits = phone.replace(/\D/g, '').slice(-10);
  const url = `https://api.numlookupapi.com/v1/info/+1${digits}?apikey=${process.env.NUMLOOKUP_API_KEY}`;
  
  try {
    const r = await fetch(url);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return res.status(200).json({ status: r.status, url, data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}