# SCHOOLER — Smart Attendance Platform

A geo-locked, QR-based attendance PWA for universities and colleges.

---

## Features

- **Rotating QR Code** — refreshes every 10 seconds, expired codes are rejected
- **Geo-fencing** — students must be within 30 metres of the lecturer's location
- **GPS Accuracy Check** — rejects check-ins with weak GPS signal (>150m accuracy)
- **Timestamped Records** — every check-in is logged with exact time
- **Anti-fraud** — duplicate matric entries are blocked per session
- **Export to Excel** — full attendance sheet downloadable as .xlsx
- **Dark / Light Mode** — toggle in the navbar
- **Installable PWA** — works offline, installable on Android and iOS
- **BroadcastChannel** — real-time sync between lecturer and student tabs on same device
- **Session PIN** — backup session identifier for manual entry

---

## How to Use

### For Lecturers
1. Open the app and select **Lecturer**
2. Enter your name, course code, and department → **Continue**
3. On the dashboard, confirm/enter the course code and session duration
4. Click **Start Session & Generate QR** — the app will lock your current GPS location
5. Display the rotating QR on a projector or your phone for students to scan
6. Watch attendance populate in real time
7. Click **Export Excel** when done

### For Students
1. Open the app and select **Student**
2. Enter your name, matric number, and course code → **Continue**
3. Tap **Start Scanner** — allow camera and location permissions
4. Point your camera at the lecturer's QR code
5. If you're within 30m and the QR is valid, you're marked present
6. If the camera fails, expand **"Enter session code manually"** and type the 8-character code shown on the lecturer's screen

---

## Deployment

**Local (recommended for testing):**
```bash
# Any static file server works
npx serve .
# or
python3 -m http.server 8080
```
Then open `http://localhost:8080` on your device.

**Production:**
Deploy to any static host (Netlify, Vercel, GitHub Pages, Hostinger).
HTTPS is required for:
- Camera access (getUserMedia)
- Geolocation
- Service Worker / PWA install

---

## Anti-Fraud Measures

| Threat | Countermeasure |
|---|---|
| Remote check-in | GPS geo-fence (30m radius from lecturer) |
| Shared QR screenshot | QR expires every 10 seconds |
| Weak/spoofed GPS | Accuracy threshold check (≤150m) |
| Duplicate submissions | Matric number deduplication per session |
| Old QR codes | Server-side expiry timestamp in payload |
| Session hopping | Session ID embedded and validated in QR |

---

## File Structure

```
schooler/
├── index.html          — Main app shell
├── manifest.json       — PWA manifest
├── sw.js               — Service worker (offline + caching)
├── css/
│   └── style.css       — All styles (dark/light modes)
├── js/
│   ├── app.js          — Core application logic
│   ├── qrgen.js        — QRious library (QR generation)
│   ├── jsQR.js         — jsQR library (QR scanning)
│   └── xlsx.full.min.js — SheetJS (Excel export)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Libraries Used

- **QRious 4.0.2** — QR code generation (canvas-based)
- **jsQR 1.4.0** — QR code scanning from video frames
- **SheetJS / xlsx 0.18.5** — Excel file export
- **Google Fonts** — Inter + Space Grotesk

---

Built by SCHOOLER · v1.0.0
