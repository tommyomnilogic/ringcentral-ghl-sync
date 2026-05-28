// pages/api/auth/login.js
// Redirects to Microsoft login to authorize Ashley's email access

import { getAuthUrl } from '../../../lib/msAuth';

export default function handler(req, res) {
  const url = getAuthUrl();
  res.redirect(url);
}
