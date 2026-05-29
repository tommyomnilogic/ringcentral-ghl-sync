import { getAccessToken } from '../../lib/msAuth';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
export default async function handler(req, res) {
  try {
    const accessToken = await getAccessToken();
    const foldersRes = await fetch(`${GRAPH_BASE}/me/mailFolders?$top=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const foldersData = await foldersRes.json();
    const folders = foldersData.value || [];
    const callNotesFolder = folders.find(f =>
      f.displayName.toLowerCase().includes('call note')
    );
    let emails = [];
    if (callNotesFolder) {
      const emailsRes = await fetch(
        `${GRAPH_BASE}/me/mailFolders/${callNotesFolder.id}/messages?$top=10&$select=id,subject,receivedDateTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const emailsData = await emailsRes.json();
      emails = emailsData.value || [];
    }
    return res.status(200).json({
      folders: folders.map(f => ({ name: f.displayName, count: f.totalItemCount })),
      callNotesFolder: callNotesFolder || 'NOT FOUND',
      emails: emails.map(e => ({ subject: e.subject, received: e.receivedDateTime })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}