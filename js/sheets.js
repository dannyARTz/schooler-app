/* ══════════════════════════════════════════════════
   SCHOOLER — Google Sheets Bridge  v1.4.0
   
   KEY FIXES from v1.3:
   ────────────────────
   ✦ Students now correctly write to the lecturer's
     sheet (spreadsheetId embedded in QR payload and
     extracted before any Sheets call)
   ✦ Both lecturer AND student OAuth tokens stored
   ✦ QR_Live row existence tracked in memory (no
     extra read on every 10s push)
   ✦ Attendance rows store ISO timestamp for reliable
     parsing on lecturer poll
   ✦ Duplicate guard uses deviceId+matric+sessionId
     so same phone can't submit twice regardless of
     account switching
   ✦ API call count reduced from 4→1 per QR push
══════════════════════════════════════════════════ */

'use strict';

const SHEETS = {
  accessToken:    null,   // OAuth2 Bearer token (in-memory only, never stored)
  spreadsheetId:  null,   // set from lecturer bootstrap OR from QR payload
  pollInterval:   null,   // student QR poll interval
  attendPollInt:  null,   // lecturer attendance poll interval
  POLL_MS:        3000,   // student QR poll frequency
  ATTEND_MS:      4000,   // lecturer attendance poll frequency
  lastToken:      null,   // last seen QR token (detect changes)
  userEmail:      null,
  qrLiveRowExists: false, // track whether row 2 of QR_Live has been written yet
};

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API  = 'https://www.googleapis.com/drive/v3/files';
const USERINFO   = 'https://www.googleapis.com/oauth2/v3/userinfo';

const TAB = {
  sessions:   'Sessions',
  attendance: 'Attendance',
  qrLive:     'QR_Live',
  audit:      'Audit_Log',
};

const HEADERS = {
  sessions:   ['SessionID','Date','Course','Lecturer','LecturerEmail','StartedAt','EndsAt','Status','Settings','BLEActive','SpreadsheetID','CreatedAt'],
  attendance: ['SessionID','Date','Course','StudentName','StudentEmail','Matric','DeviceID','CheckInTime','CheckInISO','Distance','BLEVerified','Status','SpotResult'],
  qrLive:     ['SessionID','Token','Expiry','Course','SpreadsheetID','Lat','Lng','GeoEnabled','GeoRadius','DeviceBinding','Selfie','BLE','PIN','Date','UpdatedAt'],
  audit:      ['Timestamp','Action','SessionID','UserEmail','Detail'],
};

// ─── Token / ID management ───────────────────────
function sheetsSetToken(token) { SHEETS.accessToken = token; }
function sheetsSetEmail(email) { SHEETS.userEmail   = email; }
function sheetsSetSpreadsheetId(id) {
  SHEETS.spreadsheetId  = id;
  SHEETS.qrLiveRowExists = false; // reset row tracker on new sheet
}
function sheetsIsReady() { return !!(SHEETS.accessToken && SHEETS.spreadsheetId); }
function sheetsGetUrl()  { return SHEETS.spreadsheetId || null; } // compat shim

// ─── Fetch Google user profile from token ────────
async function sheetsFetchUserInfo(accessToken) {
  const res = await fetch(USERINFO, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Could not fetch user profile');
  return res.json(); // { sub, name, email, picture }
}

// ─── Core API call ───────────────────────────────
async function sheetsAPI(method, path, body = null, useSpreadsheetBase = true) {
  if (!SHEETS.accessToken) throw new Error('Not authenticated');
  const base = useSpreadsheetBase ? SHEETS_API : '';
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${SHEETS.accessToken}`,
      'Content-Type':  'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Bootstrap (lecturer only) ───────────────────
async function sheetsBootstrap(email) {
  SHEETS.userEmail = email;
  const cacheKey   = `schooler_sheet_id_${email}`;
  const cached     = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      // Quick verify: just fetch spreadsheet metadata
      await sheetsAPI('GET', `/${cached}?fields=spreadsheetId`);
      sheetsSetSpreadsheetId(cached);
      return { spreadsheetId: cached, isNew: false };
    } catch(e) {
      localStorage.removeItem(cacheKey);
    }
  }

  // Search Drive for existing sheet
  const q   = `name='SCHOOLER — ${email}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { 'Authorization': `Bearer ${SHEETS.accessToken}` } }
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    const id = data.files[0].id;
    localStorage.setItem(cacheKey, id);
    sheetsSetSpreadsheetId(id);
    return { spreadsheetId: id, isNew: false };
  }

  // Create new spreadsheet with all 4 tabs
  const created = await sheetsAPI('POST', '', {
    properties: { title: `SCHOOLER — ${email}` },
    sheets: Object.values(TAB).map(t => ({ properties: { title: t } })),
  });

  const id = created.spreadsheetId;
  sheetsSetSpreadsheetId(id);
  localStorage.setItem(cacheKey, id);

  // Write all headers in one batchUpdate
  await sheetsAPI('POST', `/${id}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: Object.entries(HEADERS).map(([key, hdrs]) => ({
      range:  `${TAB[key]}!A1`,
      values: [hdrs],
    })),
  });

  // Style header rows blue
  const sheetIdMap = created.sheets.reduce((m, s) => {
    m[s.properties.title] = s.properties.sheetId; return m;
  }, {});
  await sheetsAPI('POST', `/${id}:batchUpdate`, {
    requests: Object.values(sheetIdMap).map(sheetId => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell:  { userEnteredFormat: {
          backgroundColor: { red: 0.102, green: 0.424, blue: 1 },
          textFormat: { foregroundColor: { red:1, green:1, blue:1 }, bold: true },
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })),
  });

  return { spreadsheetId: id, isNew: true };
}

// ─── Low-level helpers ───────────────────────────
async function sheetsAppend(tab, values) {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  return sheetsAPI(
    'POST',
    `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [values] }
  );
}

async function sheetsRead(tab, range = 'A1:Z') {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  const res = await sheetsAPI('GET', `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(tab + '!' + range)}`);
  return res.values || [];
}

async function sheetsUpdate(range, values) {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  return sheetsAPI(
    'PUT',
    `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { values }
  );
}

// ═══════════════════════════════════════════════════
//  SESSION OPERATIONS
// ═══════════════════════════════════════════════════

async function sheetsWriteSession(s) {
  await sheetsAppend(TAB.sessions, [
    s.sessionId, s.date, s.course, s.lecturer,
    s.lecturerEmail || SHEETS.userEmail || '',
    s.startedAt, s.endsAt, 'active',
    s.settings, 'false',
    SHEETS.spreadsheetId, // embed sheet ID in session row too
    new Date().toISOString(),
  ]);
  return { ok: true };
}

async function sheetsEndSession(sessionId) {
  // Read sessions to find the row number
  const rows = await sheetsRead(TAB.sessions);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === sessionId) {
      await sheetsUpdate(`${TAB.sessions}!H${i+1}`, [['ended']]);
      break;
    }
  }
  // Clear QR_Live
  if (SHEETS.qrLiveRowExists) {
    try {
      await sheetsUpdate(`${TAB.qrLive}!A2:O2`,
        [['','','','','','','','','','','','','','','']]);
    } catch(e) {}
    SHEETS.qrLiveRowExists = false;
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════
//  QR TOKEN  (one row, row 2 of QR_Live)
// ═══════════════════════════════════════════════════

async function sheetsPushQRToken(b) {
  const row = [
    b.sessionId, b.token, String(b.expiry),
    b.course,
    SHEETS.spreadsheetId,              // ← KEY: students read this to know which sheet to write to
    b.lat ?? '', b.lng ?? '',
    b.geo    ? 'true' : 'false',
    String(b.geoRadius || 50),
    b.device ? 'true' : 'false',
    b.selfie ? 'true' : 'false',
    b.ble    ? 'true' : 'false',
    b.pin || '',
    b.date || fmtDate(new Date()),
    new Date().toISOString(),
  ];

  if (SHEETS.qrLiveRowExists) {
    // Just update — 1 API call
    await sheetsUpdate(`${TAB.qrLive}!A2:O2`, [row]);
  } else {
    // First time — append
    await sheetsAppend(TAB.qrLive, row);
    SHEETS.qrLiveRowExists = true;
  }
  return { ok: true };
}

async function sheetsPollQRToken() {
  // Students call this to get the live token
  // SHEETS.spreadsheetId must already be set (from cached lecturer sheet ID)
  if (!SHEETS.spreadsheetId) return { token: null };
  const rows = await sheetsRead(TAB.qrLive, 'A2:O2');
  if (!rows.length) return { token: null };
  const r      = rows[0];
  const expiry = Number(r[2]);
  if (!r[0]) return { token: null };
  if (expiry && Date.now() > expiry + 5000) return { token: null, expired: true };
  return {
    sessionId:     r[0],
    token:         r[1],
    expiry,
    course:        r[3],
    spreadsheetId: r[4],  // students pick this up here
    lat:           r[5] || null,
    lng:           r[6] || null,
    geo:           r[7] === 'true',
    geoRadius:     Number(r[8]) || 50,
    device:        r[9] === 'true',
    selfie:        r[10] === 'true',
    ble:           r[11] === 'true',
    pin:           r[12],
    date:          r[13],
  };
}

// ═══════════════════════════════════════════════════
//  ATTENDANCE  
// ═══════════════════════════════════════════════════

async function sheetsAppendAttendance(record) {
  if (!sheetsIsReady()) throw new Error('Sheets not ready — no spreadsheet ID or token');

  // Server-side duplicate guard (belt-and-suspenders after local check)
  try {
    const rows = await sheetsRead(TAB.attendance);
    for (let i = 1; i < rows.length; i++) {
      // Check sessionId + deviceId (col 0 + col 6)
      if (rows[i][0] === record.sessionId && rows[i][6] === record.deviceId) {
        return { ok: false, duplicate: true, reason: 'device' };
      }
      // Also check sessionId + matric (col 0 + col 5)
      if (rows[i][0] === record.sessionId && rows[i][5] === record.matric) {
        return { ok: false, duplicate: true, reason: 'matric' };
      }
    }
  } catch(e) {
    // If we can't read (quota/network), proceed with append anyway
    // Local device check already ran before this point
  }

  const now = new Date(record.timestamp);
  await sheetsAppend(TAB.attendance, [
    record.sessionId,
    record.date    || fmtDate(now),
    record.course,
    record.name,
    record.googleEmail || '',
    record.matric,
    record.deviceId,
    now.toLocaleTimeString('en-NG'),   // human-readable time
    now.toISOString(),                 // ISO for reliable parsing
    record.distance ?? '',
    record.bleVerified ? 'Yes' : 'No',
    'present',
    '',                                // SpotResult — filled later
  ]);
  return { ok: true };
}

async function sheetsReadAttendance(sessionId) {
  const rows   = await sheetsRead(TAB.attendance);
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== sessionId) continue;
    result.push({
      sessionId:   rows[i][0],
      date:        rows[i][1],
      course:      rows[i][2],
      studentName: rows[i][3],
      googleEmail: rows[i][4],
      matric:      rows[i][5],
      deviceId:    rows[i][6],
      checkInTime: rows[i][7],
      checkInISO:  rows[i][8],   // use this for timestamp parsing
      distance:    rows[i][9],
      bleVerified: rows[i][10] === 'Yes',
      status:      rows[i][11],
      spotResult:  rows[i][12],
    });
  }
  return { rows: result };
}

async function sheetsUpdateSpotCheck(sessionId, matric, result) {
  const rows = await sheetsRead(TAB.attendance);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === sessionId && rows[i][5] === matric) {
      await sheetsUpdate(`${TAB.attendance}!M${i+1}`, [[result]]);
      if (result === 'absent') await sheetsUpdate(`${TAB.attendance}!L${i+1}`, [['flagged']]);
      return { ok: true };
    }
  }
  return { ok: false };
}

// ═══════════════════════════════════════════════════
//  POLLING
// ═══════════════════════════════════════════════════

// Student polls QR_Live for live token changes
function sheetsStartPolling(onNewToken) {
  sheetsStopPolling();
  SHEETS.pollInterval = setInterval(async () => {
    if (!SHEETS.accessToken || !SHEETS.spreadsheetId) return;
    try {
      const data = await sheetsPollQRToken();
      if (!data || !data.token) return;
      // Pick up spreadsheetId if student got it from QR payload earlier
      if (data.spreadsheetId && data.spreadsheetId !== SHEETS.spreadsheetId) {
        sheetsSetSpreadsheetId(data.spreadsheetId);
      }
      if (data.token !== SHEETS.lastToken) {
        SHEETS.lastToken = data.token;
        onNewToken(data);
      }
    } catch(e) { /* silent — poll continues */ }
  }, SHEETS.POLL_MS);
}

function sheetsStopPolling() {
  clearInterval(SHEETS.pollInterval);
  SHEETS.pollInterval = null;
  SHEETS.lastToken    = null;
}

// Lecturer polls Attendance for new student check-ins
function sheetsStartAttendancePoll(sessionId, onNewRecord) {
  sheetsStopAttendancePoll();
  const seen = new Set(); // track already-seen deviceIds this poll session
  SHEETS.attendPollInt = setInterval(async () => {
    if (!sheetsIsReady()) return;
    try {
      const { rows } = await sheetsReadAttendance(sessionId);
      rows.forEach(row => {
        const key = `${row.deviceId}_${row.matric}`;
        if (seen.has(key)) return;
        seen.add(key);
        onNewRecord(row);
      });
    } catch(e) {}
  }, SHEETS.ATTEND_MS);
}

function sheetsStopAttendancePoll() {
  clearInterval(SHEETS.attendPollInt);
  SHEETS.attendPollInt = null;
}

// ─── Compat shim (app.js calls pushToSheets which calls this) ──
async function sheetsRequest(action, payload) {
  switch(action) {
    case 'ping':                return { ok: true };
    case 'writeSession':        return sheetsWriteSession(payload);
    case 'updateSessionStatus': return sheetsEndSession(payload.sessionId);
    case 'pushQRToken':         return sheetsPushQRToken(payload);
    case 'pollQRToken':         return sheetsPollQRToken();
    case 'appendAttendance':    return sheetsAppendAttendance(payload);
    case 'readAttendance':      return sheetsReadAttendance(payload.sessionId);
    case 'updateSpotCheck':     return sheetsUpdateSpotCheck(payload.sessionId, payload.matric, payload.result);
    case 'updateBLEBeacon':     return { ok: true }; // handled inline
    default: throw new Error(`Unknown: ${action}`);
  }
}

function fmtDate(d) {
  return d.toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
}
