/* ══════════════════════════════════════════════════
   SCHOOLER — Sheets Bridge  v2.0  (FINAL)

   Architecture: ALL calls go through the lecturer's
   deployed Apps Script URL (/exec endpoint).

   The Apps Script runs as the LECTURER (who authorized
   it), so it can read/write THEIR sheet freely.
   Students POST to the same URL — no OAuth needed.
   No CORS issues because Apps Script handles that.

   Flow:
   ─────
   Lecturer signs in with Google → gets OAuth token
   → fetches their Apps Script URL from /exec?ping
     (URL stored locally after first entry)
   → starts session → pushes QR token every 10s
   → polls attendance every 4s

   Student opens app → enters Apps Script URL once
   (or gets it from QR payload) → scans QR
   → POSTs attendance to URL → appears on lecturer
     dashboard within 4s
══════════════════════════════════════════════════ */

'use strict';

const GAS = {
  url:          null,   // Apps Script /exec URL
  pollQR:       null,   // student QR poll interval
  pollAttend:   null,   // lecturer attendance poll interval
  POLL_QR_MS:   3000,
  POLL_ATT_MS:  4000,
  lastToken:    null,
  seenRecords:  new Set(), // lecturer: keys of records already shown
};

// ─── URL management ──────────────────────────────
const GAS_URL_KEY = 'schooler_gas_url';

function gasSetUrl(url) {
  GAS.url = url;
  localStorage.setItem(GAS_URL_KEY, url);
}

function gasGetUrl() {
  if (GAS.url) return GAS.url;
  const saved = localStorage.getItem(GAS_URL_KEY);
  if (saved) { GAS.url = saved; return saved; }
  return null;
}

function gasIsReady() { return !!GAS.url; }

// ─── Core POST ────────────────────────────────────
async function gasPost(action, payload = {}) {
  const url = gasGetUrl();
  if (!url) throw new Error('NO_GAS_URL');

  const body = JSON.stringify({ action, ...payload });
  const res  = await fetch(url, {
    method:  'POST',
    // Apps Script needs text/plain to avoid OPTIONS preflight
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.ok === false) throw new Error(data.error || 'Script error');
  return data;
}

// ─── Test connection ──────────────────────────────
async function gasPing() {
  return gasPost('ping');
  // returns { ok:true, spreadsheetId, version }
}

// ─── Session ops ─────────────────────────────────
async function gasWriteSession(s) {
  return gasPost('writeSession', {
    sessionId:     s.sessionId,
    date:          s.date,
    course:        s.course,
    lecturer:      s.lecturer,
    lecturerEmail: s.lecturerEmail || '',
    startedAt:     s.startedAt,
    endsAt:        s.endsAt,
    settings:      s.settings || '',
  });
}

async function gasEndSession(sessionId) {
  return gasPost('endSession', { sessionId });
}

// ─── QR token — lecturer pushes every 10s ────────
async function gasPushQRToken(b) {
  return gasPost('pushQRToken', {
    sessionId:     b.sessionId,
    token:         b.token,
    expiry:        b.expiry,
    course:        b.course,
    lat:           b.lat ?? '',
    lng:           b.lng ?? '',
    geo:           b.geo    ? '1' : '0',
    geoRadius:     b.geoRadius || 50,
    device:        b.device ? '1' : '0',
    selfie:        b.selfie ? '1' : '0',
    ble:           b.ble    ? '1' : '0',
    pin:           b.pin    || '',
    date:          b.date   || '',
    spreadsheetId: b.spreadsheetId || '',
  });
}

// ─── QR poll — student calls every 3s ────────────
async function gasPollQRToken() {
  return gasPost('pollQRToken');
  // returns live token data or { ok:true, token:null }
}

// ─── Attendance — student submits ─────────────────
async function gasSubmitAttendance(record) {
  return gasPost('submitAttendance', {
    sessionId:   record.sessionId,
    date:        record.date,
    course:      record.course,
    name:        record.name,
    googleEmail: record.googleEmail || '',
    matric:      record.matric,
    deviceId:    record.deviceId,
    distance:    record.distance ?? '',
    bleVerified: record.bleVerified ? '1' : '0',
  });
}

// ─── Attendance — lecturer polls every 4s ─────────
async function gasGetAttendance(sessionId) {
  return gasPost('getAttendance', { sessionId });
  // returns { ok:true, rows: [...] }
}

// ─── Spot check ───────────────────────────────────
async function gasSpotCheck(sessionId, matric, result) {
  return gasPost('spotCheck', { sessionId, matric, result });
}

// ═══════════════════════════════════════════════════
//  POLLING LOOPS
// ═══════════════════════════════════════════════════

// Student: poll QR_Live for new token every 3s
function sheetsStartPolling(onNewToken) {
  sheetsStopPolling();
  GAS.pollQR = setInterval(async () => {
    if (!gasIsReady()) return;
    try {
      const data = await gasPollQRToken();
      if (!data || !data.token) return;
      if (data.token !== GAS.lastToken) {
        GAS.lastToken = data.token;
        onNewToken(data);
      }
    } catch(e) { /* silent */ }
  }, GAS.POLL_QR_MS);
}

function sheetsStopPolling() {
  clearInterval(GAS.pollQR);
  GAS.pollQR    = null;
  GAS.lastToken = null;
}

// Lecturer: poll Attendance for new rows every 4s
function sheetsStartAttendancePoll(sessionId, onNewRecord) {
  sheetsStopAttendancePoll();
  GAS.seenRecords.clear();
  GAS.pollAttend = setInterval(async () => {
    if (!gasIsReady()) return;
    try {
      const data = await gasGetAttendance(sessionId);
      if (!data || !data.rows) return;
      data.rows.forEach(row => {
        const key = `${row.deviceId}_${row.matric}`;
        if (GAS.seenRecords.has(key)) return;
        GAS.seenRecords.add(key);
        onNewRecord(row);
      });
    } catch(e) { /* silent */ }
  }, GAS.POLL_ATT_MS);
}

function sheetsStopAttendancePoll() {
  clearInterval(GAS.pollAttend);
  GAS.pollAttend = null;
}

// ═══════════════════════════════════════════════════
//  COMPAT SHIMS  (app.js calls these names)
// ═══════════════════════════════════════════════════
function sheetsGetUrl()                  { return gasGetUrl(); }
function sheetsIsReady_()                { return gasIsReady(); }

async function sheetsRequest(action, payload) {
  switch(action) {
    case 'ping':                return gasPing();
    case 'writeSession':        return gasWriteSession(payload);
    case 'updateSessionStatus': return gasEndSession(payload.sessionId);
    case 'pushQRToken':         return gasPushQRToken(payload);
    case 'pollQRToken':         return gasPollQRToken();
    case 'appendAttendance':    return gasSubmitAttendance(payload);
    case 'readAttendance':      return gasGetAttendance(payload.sessionId);
    case 'updateSpotCheck':     return gasSpotCheck(payload.sessionId, payload.matric, payload.result);
    default: throw new Error('Unknown action: ' + action);
  }
}

// sheetsAppendAttendance is called directly from handleQRData
async function sheetsAppendAttendance(record) {
  return gasSubmitAttendance(record);
}

// sheetsBootstrap is called from lecturer sign-in — just ping to confirm URL works
async function sheetsBootstrap(email) {
  const data = await gasPing();
  return { spreadsheetId: data.spreadsheetId, isNew: false };
}

// These were OAuth-only — no longer needed, kept as no-ops
function sheetsSetToken(token) {}
function sheetsSetEmail(email) {}
function sheetsSetSpreadsheetId(id) {}
function sheetsFetchUserInfo(token) {
  return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
}
