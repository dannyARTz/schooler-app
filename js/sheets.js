/* ══════════════════════════════════════════════════
   SCHOOLER — Google Sheets Bridge  v1.2.0
   
   Uses Google Apps Script as a free REST API layer.
   No server, no database — just a Script deployment.
   
   HOW IT WORKS:
   ─────────────
   Lecturer sets their Apps Script URL once (stored
   in localStorage). All data flows through that URL:
   
   ► Lecturer writes session + QR token to Sheets
   ► Students poll Sheets every 3s to get live token
   ► Student check-ins append rows to Sheets
   ► Lecturer dashboard reads live from Sheets
   
   SHEETS STRUCTURE (auto-created by Apps Script):
   ─────────────────────────────────────────────────
   Sheet "Sessions":
     SessionID | Date | Course | Lecturer | StartedAt | EndsAt | Status | QRToken | QRExpiry | Settings(JSON)
   
   Sheet "Attendance":
     SessionID | Date | Course | StudentName | Matric | CheckInTime | DeviceID | Distance | Status | SpotResult
   
   Sheet "QR_Live":   (single-row, updated every 10s)
     SessionID | Token | Expiry | Course | Lat | Lng | GeoEnabled | GeoRadius | DeviceBinding | Selfie | PIN
══════════════════════════════════════════════════ */

'use strict';

const SHEETS = {
  url:          null,   // Apps Script web app URL
  pollInterval: null,   // student polling interval
  POLL_MS:      3000,   // how often students poll for live QR
  lastToken:    null,   // last known QR token (detect changes)
};

// ─── Setup ───────────────────────────────────────
function sheetsInit(url) {
  SHEETS.url = url;
  localStorage.setItem('schooler_sheets_url', url);
}

function sheetsGetUrl() {
  if (SHEETS.url) return SHEETS.url;
  const saved = localStorage.getItem('schooler_sheets_url');
  if (saved) { SHEETS.url = saved; return saved; }
  return null;
}

// ─── Core fetch wrapper ───────────────────────────
async function sheetsRequest(action, payload = {}) {
  const url = sheetsGetUrl();
  if (!url) throw new Error('NO_URL');

  const body = JSON.stringify({ action, ...payload });
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script needs text/plain to avoid CORS preflight
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─── Session operations ───────────────────────────

/** Write a new session row to Sheets */
async function sheetsWriteSession(session, user) {
  return sheetsRequest('writeSession', {
    sessionId:  session.id,
    date:       formatDateOnly(new Date()),
    course:     session.course,
    lecturer:   user.name,
    startedAt:  new Date(session.startedAt).toISOString(),
    endsAt:     new Date(session.endsAt).toISOString(),
    status:     'active',
    settings:   JSON.stringify(session.settings),
  });
}

/** Update session status (active → ended) */
async function sheetsEndSession(sessionId) {
  return sheetsRequest('updateSessionStatus', { sessionId, status: 'ended' });
}

/** Push the current live QR token so students can poll it */
async function sheetsPushQRToken(session) {
  return sheetsRequest('pushQRToken', {
    sessionId: session.id,
    token:     session.qrToken,
    expiry:    session.qrExpiry,
    course:    session.course,
    lat:       session.lat ?? '',
    lng:       session.lng ?? '',
    geo:       session.settings.geo,
    geoRadius: session.settings.geoRadius,
    device:    session.settings.device,
    selfie:    session.settings.selfie,
    pin:       session.pin,
  });
}

/** Student polls this to get current valid QR payload */
async function sheetsPollQRToken() {
  return sheetsRequest('pollQRToken', {});
}

// ─── Attendance operations ────────────────────────

/** Append a student check-in row */
async function sheetsAppendAttendance(record) {
  return sheetsRequest('appendAttendance', {
    sessionId:   record.sessionId,
    date:        formatDateOnly(new Date(record.timestamp)),
    course:      record.course,
    studentName: record.name,
    matric:      record.matric,
    checkInTime: new Date(record.timestamp).toLocaleTimeString('en-NG'),
    deviceId:    record.deviceId,
    distance:    record.distance ?? '',
    status:      'present',
    spotResult:  '',
  });
}

/** Read all attendance for a session */
async function sheetsReadAttendance(sessionId) {
  return sheetsRequest('readAttendance', { sessionId });
}

/** Update spot check result for a student */
async function sheetsUpdateSpotCheck(sessionId, matric, result) {
  return sheetsRequest('updateSpotCheck', { sessionId, matric, result });
}

// ─── Student polling ──────────────────────────────

/** Start polling Sheets for live QR token updates (student side) */
function sheetsStartPolling(onNewToken) {
  if (SHEETS.pollInterval) clearInterval(SHEETS.pollInterval);
  SHEETS.pollInterval = setInterval(async () => {
    try {
      const data = await sheetsPollQRToken();
      if (!data || !data.token) return;
      if (data.token !== SHEETS.lastToken) {
        SHEETS.lastToken = data.token;
        onNewToken(data); // pass full token data to handler
      }
    } catch(e) {
      // Silent fail — polling continues
    }
  }, SHEETS.POLL_MS);
}

function sheetsStopPolling() {
  if (SHEETS.pollInterval) clearInterval(SHEETS.pollInterval);
  SHEETS.pollInterval = null;
  SHEETS.lastToken    = null;
}

// ─── Helpers ─────────────────────────────────────
function formatDateOnly(date) {
  return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}
