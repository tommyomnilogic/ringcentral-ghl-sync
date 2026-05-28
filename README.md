# RingCentral → GoHighLevel Call Notes Sync

Automatically syncs RingCentral AI call note emails from Ashley's Outlook inbox into GoHighLevel CRM contacts.

## What it does

- Polls Ashley's Outlook "Call Notes" folder every 5 minutes
- Parses RingCentral call note emails (contact name, phone, summary, recap, tasks)
- Matches contacts in GHL by phone number
- Dashboard to review all call notes, resolve unmatched contacts, and assign tasks to GHL users

## Dashboard Features

- **Matched contacts** → confirm and log note + tasks directly to GHL
- **Unmatched contacts** → search GHL to find the right contact, create new, or ignore
- **Task assignment** → assign each task to any GHL user or ignore it
- **Filter by status** → All / Pending / No Match / Logged / Ignored
- **Manual poll** → trigger a check anytime with "Poll Now" button

---

## Deployment to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ringcentral-ghl-sync.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy**

### Step 3 — Add Environment Variables

In Vercel → Your Project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `AZURE_CLIENT_ID` | `7c41647c-e074-414a-b28d-1352b8b4d822` |
| `AZURE_TENANT_ID` | `dda64e65-8f08-4e3d-b022-f1c1604f898f` |
| `AZURE_CLIENT_SECRET` | *(from Azure portal)* |
| `GHL_API_KEY` | *(from GoHighLevel)* |
| `GHL_LOCATION_ID` | `7ZVXNPvaTTHCO2wcpdnk` |
| `NEXT_PUBLIC_APP_URL` | `https://ringcentral-ghl-sync.vercel.app` |

Redeploy after adding variables.

### Step 4 — Authorize Ashley's Outlook

1. Visit: `https://ringcentral-ghl-sync.vercel.app/api/auth/login`
2. Sign in as Ashley (ashley@gofedretire.com)
3. Grant the requested permissions
4. Copy the `MS_REFRESH_TOKEN` shown on the success page
5. Add it to Vercel environment variables → Redeploy

### Step 5 — Done!

- Visit `/dashboard` to manage call notes
- The app polls automatically every 5 minutes via Vercel Cron
- Use "Poll Now" on the dashboard to check immediately

---

## Architecture

```
Ashley's Outlook (Call Notes folder)
        ↓  Microsoft Graph API (every 5 min)
  /api/poll  →  parseEmail.js  →  searchContactByPhone (GHL)
        ↓
   store.js (records in /tmp)
        ↓
  /dashboard  →  user assigns tasks, resolves unmatched contacts
        ↓
  /api/ghl/log  →  addNote + createTasks in GoHighLevel
```

## File Structure

```
pages/
  index.js              → redirects to /dashboard
  dashboard.js          → main UI
  api/
    poll.js             → Outlook poller (Vercel Cron)
    records.js          → get all records
    auth/
      login.js          → start OAuth flow
      callback.js       → handle OAuth callback, display refresh token
    ghl/
      search.js         → search GHL contacts
      users.js          → get GHL users
      log.js            → log note + tasks to GHL
lib/
  msAuth.js             → Microsoft token management
  parseEmail.js         → RingCentral email parser
  ghl.js                → GHL API helpers
  store.js              → simple JSON record store
```
