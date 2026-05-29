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
    const withChildren = [];
    for (const folder of folders) {
      const subRes = await fetch(`${GRAPH_BASE}/me/mailFolders/${folder.id}/childFolders?$top=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const subData = subRes.ok ? await subRes.json() : { value: [] };
      withChildren.push({
        name: folder.displayName,
        count: folder.totalItemCount,
        subfolders: (subData.value || []).map(s => ({ name: s.displayName, count: s.totalItemCount, id: s.id })),
      });
    }
    return res.status(200).json({ folders: withChildren });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}