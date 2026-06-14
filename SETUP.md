# SCHOOLER v1.2.0 — Setup Guide

## How the system works without a database

SCHOOLER uses **Google Sheets + Apps Script** as its entire backend:

```
Lecturer device                  Google Sheets
──────────────                   ─────────────────────────────────
Start session    ─── writes ───► Sessions sheet  (session metadata)
Generate QR      ─── writes ───► QR_Live sheet   (current token, updated every 10s)
End session      ─── writes ───► Sessions sheet  (status = ended)

Student device
──────────────
Open app         ─── polls ────► QR_Live sheet   (gets live token every 3s)
Scan QR          ─── writes ───► Attendance sheet (check-in row)
Export           ◄── reads ─────  All sheets     (downloaded as Excel)
```

## Step 1 — Create your Google Apps Script

1. Go to **https://script.google.com**
2. Click **New Project**
3. Delete all code in the editor
4. Open `google-apps-script.js` from this zip — copy everything
5. Paste it into the script editor
6. Click **Save** (Ctrl+S or ⌘+S) — name it "SCHOOLER Backend"

## Step 2 — Deploy as a Web App

1. Click **Deploy** → **New Deployment**
2. Click the gear icon next to "Type" → select **Web App**
3. Fill in:
   - Description: `SCHOOLER v1.2.0`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Click **Authorize access** → choose your Google account → Allow
6. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/ABC123.../exec`)

## Step 3 — Connect SCHOOLER

1. Open SCHOOLER in your browser
2. On first launch, the setup screen appears automatically
3. Paste the URL into the field
4. Click **Connect** — it will test the connection
5. If successful, you'll see **"✓ Sheets connected"**

---

## How sessions work day to day

| Scenario | What happens |
|---|---|
| Lecturer starts session | A new row is written to **Sessions** sheet with today's date |
| QR rotates every 10s | **QR_Live** sheet is overwritten with the new token |
| Student scans | A row is appended to **Attendance** sheet |
| Student scans again same session | **Duplicate blocked** in Sheets. Student sees friendly message |
| Next day, same course | Lecturer starts a **new session** — new Session ID, new date, fresh Attendance rows |
| Session expires | Status set to `ended`, QR_Live cleared |
| Export | Click **Export Excel** — downloads all records for the current session |
| View all records | Open your Google Sheet directly — all sessions and all check-ins are there forever |

---

## Cross-device communication

Without a server, devices talk to each other through **Google Sheets**:

1. **Lecturer's phone** writes new QR token to `QR_Live` sheet every 10 seconds
2. **Each student's phone** polls `QR_Live` every 3 seconds to get the current token
3. When a student scans (QR camera or manual code), their check-in is written to **Attendance** sheet
4. **Lecturer's dashboard** polls **Attendance** sheet every 5 seconds to show new check-ins live

This means students on **completely different networks** (mobile data, different WiFi) can all submit attendance — as long as they have internet.

---

## Offline behaviour

If a student has no internet when they scan:
- Attendance is saved in their phone's local storage
- A banner shows: *"Saved locally — will sync when internet returns"*
- When internet returns, the record is automatically submitted to Sheets
- The lecturer's dashboard picks it up in the next 5-second poll

---

## BLE (Bluetooth) setup

BLE works as a proximity layer on top of QR. When the lecturer enables BLE:

1. The **lecturer taps "Activate BLE Beacon"** in the active session panel
2. Their browser opens a Bluetooth device picker — they select their own device
3. This marks the session as "BLE beacon active" in Sheets
4. Students with BLE enabled are prompted to scan for the beacon
5. If the student's device detects the lecturer's Bluetooth signal, attendance is marked as **BLE Verified**
6. If Bluetooth is unsupported or fails, attendance continues via QR without interruption

> **Note:** Full Web Bluetooth GATT peripheral mode (advertising) is still behind flags on most browsers. The current BLE implementation uses the best available path — device picker + same-device beacon detection + Sheets flag. For production, a dedicated BLE beacon device (e.g. a Raspberry Pi running a GATT server) is recommended.

---

## Device binding & daily reset

- Each student's browser generates a **unique device ID** stored in localStorage
- On first login with a matric number, that device is **bound to the matric**
- If a student tries to scan on the **same device for the same session twice**, they see:
  > *"This device has already submitted attendance for this session. If you are using a shared device, please note: each student should use their own device. Your first scan has been recorded."*
- This **does not block them** — it informs them. The first scan is what counts.
- The next day's session has a **new Session ID** — the seen-today tracker resets automatically, so students scan fresh every day

---

## Google Sheet structure

After first use, your Sheet will have 4 tabs:

### Sessions
| SessionID | Date | Course | Lecturer | StartedAt | EndsAt | Status | QRToken | QRExpiry | Settings | BLEActive | CreatedAt |

### Attendance
| SessionID | Date | Course | StudentName | Matric | CheckInTime | DeviceID | Distance | BLEVerified | Status | SpotResult | SubmittedAt |

### QR_Live *(single live row)*
| SessionID | Token | Expiry | Course | Lat | Lng | GeoEnabled | GeoRadius | DeviceBinding | Selfie | BLE | PIN | Date | UpdatedAt |

### Audit_Log
| Timestamp | Action | SessionID | Detail |

---

## Troubleshooting

**"Connection failed" on setup**
- Make sure you selected "Anyone" for access (not "Anyone with Google account")
- Re-deploy with a new deployment if you changed the code after first deploy
- Check that you authorized the script

**Students can't scan from other devices**
- Confirm Sheets is connected (✓ indicator in navbar)
- Students need internet for Sheets polling to work
- Offline fallback: students enter the 8-char session code manually

**QR not updating**
- Check the QR_Live sheet — it should update every 10 seconds
- If it's not updating, the lecturer's device may have lost internet

**Duplicate entries in Sheets**
- The script deduplicates by matric + sessionId before appending
- If you see duplicates, they may be from the offline queue submitting twice — check the SubmittedAt column

---

## Quick deployment checklist

- [ ] Created Apps Script project
- [ ] Pasted `google-apps-script.js` contents
- [ ] Deployed as Web App (Anyone access)
- [ ] Authorized the script
- [ ] Copied Web App URL
- [ ] Pasted URL into SCHOOLER setup screen
- [ ] Saw "✓ Sheets connected" confirmation
- [ ] Shared the app URL with students and lecturers

---

Built by SCHOOLER v1.2.0
