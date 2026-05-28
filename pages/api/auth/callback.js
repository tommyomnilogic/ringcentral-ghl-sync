// pages/api/auth/callback.js
// Handles Microsoft OAuth callback and displays the refresh token

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    grant_type: 'authorization_code',
    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access',
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return res.status(500).send(`Token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  const refreshToken = tokenData.refresh_token;

  // Show the refresh token so it can be added to Vercel env vars
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Success</title>
      <style>
        body { font-family: monospace; padding: 40px; background: #0f1117; color: #e2e8f0; }
        .box { background: #1a1f2e; border: 1px solid #2d3748; padding: 24px; border-radius: 8px; margin: 20px 0; }
        .token { word-break: break-all; color: #68d391; font-size: 13px; }
        h2 { color: #68d391; }
        .step { color: #f6ad55; margin: 8px 0; }
      </style>
    </head>
    <body>
      <h2>✅ Microsoft Authorization Successful!</h2>
      <p>Ashley's Outlook account is now connected. Copy the refresh token below and add it to your Vercel environment variables.</p>
      
      <div class="box">
        <p class="step">1. Go to your Vercel project → Settings → Environment Variables</p>
        <p class="step">2. Add a new variable:</p>
        <p>&nbsp;&nbsp;&nbsp;Name: <strong>MS_REFRESH_TOKEN</strong></p>
        <p>&nbsp;&nbsp;&nbsp;Value:</p>
        <p class="token">${refreshToken}</p>
      </div>

      <div class="box">
        <p class="step">3. Redeploy your Vercel app after adding the variable</p>
        <p class="step">4. The poller will start automatically every 5 minutes</p>
        <p class="step">5. Visit <a href="/dashboard" style="color: #63b3ed;">/dashboard</a> to manage call notes</p>
      </div>
    </body>
    </html>
  `);
}
