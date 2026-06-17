# SCHOOLER v2.0 — Setup Guide

## The architecture (read this first)

SCHOOLER has **two separate identity systems** working together:

```
LECTURER                              STUDENT
────────                              ───────
1. Deploys their own Apps Script      1. Signs in with Google
   (this becomes their database)         → name + email are VERIFIED,
2. Pastes the script URL into            not typed — can't impersonate
   SCHOOLER once                         another student
3. Starts a session → the script      2. Adds matric number + course
   URL gets embedded in every QR      3. Scans the lecturer's QR
   code, refreshed every 10s             → the QR carries the lecturer's
                                            script URL to the student
                                          → student's verified identity
                                            is POSTed to that URL
                                          → the SCRIPT (running as the
                                            lecturer) writes the row
```

**Why this works:** the Apps Script runs with the *lecturer's* Google
permissions, no matter who calls it. A student's browser never touches
the lecturer's Sheet directly — it just sends data to a URL, and the
script (already authorized by the lecturer) does the writing. This is
why sync actually works now: there's no cross-account permission wall.

---

## Part A — Lecturer setup (5 minutes, once)

### 1. Create the Apps Script

1. Go to **https://script.google.com**
2. **New project**
3. Delete the default code
4. Open `google-apps-script.js` from this zip — copy all of it
5. Paste into the editor → **Save** (Ctrl/Cmd+S)

### 2. Deploy it

1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. **Deploy** → **Authorize access** → pick your Google account → **Allow**
6. Copy the URL ending in `/exec`

### 3. Connect it to SCHOOLER

1. Open SCHOOLER → **"I'm a Lecturer"**
2. Type your name
3. Paste the `/exec` URL into the Apps Script field
4. **Connect & Enter** — SCHOOLER pings the script to confirm it works

The script auto-creates a spreadsheet called **"SCHOOLER Attendance"**
in your Drive the first time it runs, with 4 tabs: `Sessions`,
`Attendance`, `QR_Live`, `Log`.

---

## Part B — Student setup (one-time, optional Google Cloud step for YOU)

Students sign in with Google to verify their identity. For the
**Sign in with Google** button to appear, you (the developer deploying
this app) need a Google OAuth Client ID — this is separate from each
lecturer's Apps Script.

### Get a Client ID (you do this once for the whole app)

1. **https://console.cloud.google.com** → new or existing project
2. **APIs & Services → OAuth consent screen** → fill in app name, configure
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: add the domain you deploy SCHOOLER to
     (e.g. `https://schooler.netlify.app`, or `http://localhost:8080` for testing)
4. Copy the Client ID

### Paste it into the app

Open `index.html`, find:
```js
window.SCHOOLER_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```
Replace with your real Client ID. Deploy. Done — every student who
visits your SCHOOLER URL afterward just clicks **Continue with Google**.

If you skip this step, SCHOOLER falls back to a simple name-entry box
(dev mode) so you can still test everything without setting up OAuth.

---

## Day-to-day flow

**Lecturer:**
1. Open SCHOOLER (already connected from setup)
2. Course code + duration → **Start Session**
3. QR appears, refreshing every 10 seconds
4. Attendance table fills in live — polled from the Sheet every 4 seconds
5. **Export Excel** any time, or open the Sheet directly in Drive

**Student:**
1. Open SCHOOLER → **"I'm a Student"**
2. **Continue with Google** → picks their account → verified name/email shown
3. Matric number + course code
4. **Enter SCHOOLER**
5. **Start Scanner** → point at the lecturer's QR
6. Done — appears on the lecturer's dashboard within ~4 seconds

---

## Anti-fraud layers, and why each one is actually enforced now

| Layer | How it's enforced |
|---|---|
| **Can't fake a name** | Name comes from the Google Sign-In button's verified token, not a text field |
| **Can't reuse a device** | Local check runs the instant the QR is decoded — before any network call — keyed to a browser fingerprint that survives `localStorage` clears |
| **Can't reuse an old QR** | Every code embeds its own expiry timestamp; checked both during decode and again server-side |
| **Can't submit from home** | Optional geofence checks GPS distance from the lecturer's location at session start |
| **Can't submit twice in Sheets** | The script checks `sessionId + deviceId` AND `sessionId + matric` before appending any row |
| **Can't intercept other sessions' data** | Each script only has one spreadsheet — the lecturer's own |

---

## Troubleshooting

**"Could not connect: HTTP 401" or similar, as a lecturer**
Your deployment access is probably set to "Only myself" instead of
"Anyone." Redeploy with **Anyone** access.

**Student scans but nothing appears on the lecturer's dashboard**
Check that the QR hasn't expired (10-second window + scan time) and
that the student has internet. If offline, their scan is queued
locally and synced automatically once they reconnect.

**Google Sign-In button doesn't appear for students**
Either `SCHOOLER_CLIENT_ID` is still the placeholder (dev mode kicks
in instead — a simple name box appears) or the domain isn't in your
OAuth Client's **Authorized JavaScript origins** list.

**"This device has already submitted attendance"**
Working as intended — that device already has a row for this exact
session. Each student needs to scan from their own device.

---

## Files in this zip

| File | Role |
|---|---|
| `google-apps-script.js` | Paste into Apps Script — this IS your backend |
| `js/sheets.js` | Talks to your deployed Apps Script URL |
| `js/app.js` | Core app logic, auth, sessions, scanning |
| `index.html` | UI shell, Google Sign-In button host |
| `SETUP.md` | This file |

---

Built by SCHOOLER v2.0
