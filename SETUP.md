# SCHOOLER v1.3.0 — Setup Guide

## What changed from v1.2

| v1.2 | v1.3 |
|---|---|
| Manual Apps Script URL paste | Google SSO — sign in, everything happens automatically |
| `google-apps-script.js` to deploy separately | No Apps Script needed at all |
| Sheets connected via URL string | OAuth2 token — your Google account IS the connection |
| Students needed no Google account | Students sign in with Google — identity verified |

---

## One-time Setup (5 minutes)

### Step 1 — Create a Google Cloud project

1. Go to **https://console.cloud.google.com**
2. Click the project dropdown → **New Project** → name it "SCHOOLER"
3. Click **Create**

### Step 2 — Enable the required APIs

In your project, go to **APIs & Services → Library** and enable:
- **Google Sheets API**
- **Google Drive API**

### Step 3 — Create OAuth credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. If prompted, configure the OAuth consent screen first:
   - User type: **External** (or Internal if you have Google Workspace)
   - App name: SCHOOLER
   - Add scopes: `spreadsheets`, `drive.file`
4. Back in Credentials → Create OAuth Client ID:
   - Application type: **Web application**
   - Name: SCHOOLER Web
   - **Authorized JavaScript origins** — add your domain:
     - For local testing: `http://localhost:8080`
     - For production: `https://yourdomain.com`
5. Click **Create** → copy the **Client ID**

### Step 4 — Add your Client ID to SCHOOLER

Open `index.html` and find this line near the bottom:

```javascript
window.SCHOOLER_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID.

### Step 5 — Deploy

Upload all files to any static host:
- **Netlify** (free): drag the `schooler/` folder to netlify.com/drop
- **Vercel** (free): `vercel --prod`
- **GitHub Pages**: push to a repo, enable Pages
- **Localhost for testing**: `npx serve .`

> HTTPS is required for camera, GPS, Bluetooth, and OAuth to work.
> Exception: `http://localhost` works for local development.

---

## How it works after setup

### Lecturer flow (zero friction)
1. Open SCHOOLER → click **"I'm a Lecturer"** → click **Continue with Google**
2. Sign in with your university Google account
3. SCHOOLER automatically creates a Google Sheet called **"SCHOOLER Attendance — your@email.com"** in your Drive
4. Start a session — QR tokens write to your Sheet every 10 seconds
5. Students' check-ins appear live in the dashboard (polled every 5 seconds from your Sheet)
6. Export to Excel any time

### Student flow
1. Open SCHOOLER → click **"I'm a Student"** → click **Continue with Google**
2. Sign in with their own Google account — this verifies identity
3. Enter matric number + course code once
4. Scan the lecturer's QR — their attendance is written to the **lecturer's** Sheet

**The anti-fraud benefit:** A student trying to mark attendance for someone else would need to log into the other student's Google account on their phone — which requires their Google password and 2FA. That's a much higher barrier than just sharing a code.

---

## Sheet structure (auto-created in lecturer's Drive)

### Sessions tab
| SessionID | Date | Course | Lecturer | LecturerEmail | StartedAt | EndsAt | Status | QRToken | QRExpiry | Settings | BLEActive | CreatedAt |

### Attendance tab
| SessionID | Date | Course | StudentName | StudentEmail | Matric | CheckInTime | DeviceID | Distance | BLEVerified | Status | SpotResult | SubmittedAt |

### QR_Live tab *(single live row — overwrites every 10s)*
| SessionID | Token | Expiry | Course | Lat | Lng | GeoEnabled | GeoRadius | DeviceBinding | Selfie | BLE | PIN | Date | UpdatedAt | SpreadsheetID |

### Audit_Log tab
| Timestamp | Action | SessionID | UserEmail | Detail |

---

## What the `StudentEmail` column gives you

Because students sign in with Google, every attendance row now has a verified `StudentEmail`. This means:

- You can cross-reference with your university's student email list
- You can detect if a student registered a fake matric number (their Google email is still there)
- Spot-checking becomes easier — you can look up who `chiamaka.obi@university.edu` actually is

---

## Token expiry and refresh

OAuth2 tokens expire after 1 hour. SCHOOLER handles this silently:
- On page reload, GIS re-issues a token without prompting the user
- If a token expires mid-session, the next Sheets call catches the 401 and triggers a silent refresh
- Users never see a sign-in prompt after the first login (as long as they stay signed in to Google)

---

## Offline behaviour

Same as v1.2 — if a student has no internet when they scan:
- Attendance saved in localStorage
- Banner shown: *"Your attendance has been saved locally and will sync once internet access is restored."*
- On reconnect, automatically submitted to the lecturer's Sheet

---

## Dev mode (no Client ID)

If you open SCHOOLER without setting a Client ID, it detects this and shows a simple name/email form instead of the Google button. Useful for:
- UI testing without OAuth setup
- Offline-only deployments
- Demos where Google sign-in isn't available

---

## Files changed from v1.2 → v1.3

| File | What changed |
|---|---|
| `index.html` | Replaced setup modal + auth form → Google SSO screen + completion screen |
| `js/sheets.js` | Replaced Apps Script calls → direct Sheets API v4 with OAuth token |
| `js/app.js` | Replaced boot/setup/auth sections → GIS integration, silent reauth, avatar pill |
| `css/style.css` | Added SSO button, avatar pill, completion screen, dev mode styles |
| `google-apps-script.js` | **No longer needed** — kept in zip for reference only |
| `SETUP.md` | This file |

---

Built by SCHOOLER v1.3.0
