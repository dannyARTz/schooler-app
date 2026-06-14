/* ══════════════════════════════════════════════════
   SCHOOLER — Google Sheets Bridge  v1.3.0
   
   Architecture change from v1.2:
   ────────────────────────────────────────────────
   OLD: Apps Script middleman URL (manual paste)
   NEW: Direct Google Sheets API v4 calls using the
        signed-in user's OAuth2 access token via GIS.
   
   HOW IT WORKS:
   ─────────────
   1. User signs in with Google SSO (GIS token client)
   2. App requests scopes: Sheets + Drive
   3. On first session start (lecturer), app creates a
      Google Sheet in the lecturer's Drive automatically
   4. All reads/writes use the Sheets API v4 REST endpoint
      with the OAuth Bearer token
   5. Students use the same token flow — they get read
      access to the QR_Live sheet via the shared sheet ID
      stored in the lecturer's published session payload
   
   SHEET AUTO-CREATED:
   ───────────────────
   Name: "SCHOOLER Attendance — [email]"
   Tabs: Sessions | Attendance | QR_Live | Audit_Log
   
   SECURITY NOTE:
   ─────────────
   The OAuth token is scoped to Sheets + Drive only.
   It lives in memory only (never persisted to storage).
   Tokens expire after 1 hour and are refreshed silently.
══════════════════════════════════════════════════ */

'use strict';

const SHEETS = {
  accessToken:  null,   // OAuth2 Bearer token (in-memory only)
  spreadsheetId: null,  // ID of the lecturer's SCHOOLER sheet
  pollInterval: null,
  POLL_MS:      3000,
  lastToken:    null,
  userEmail:    null,
};

// Google Sheets API v4 base URL
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API  = 'https://www.googleapis.com/drive/v3/files';

// Sheet tab names
const TAB = {
  sessions:   'Sessions',
  attendance: 'Attendance',
  qrLive:     'QR_Live',
  audit:      'Audit_Log',
};

// Column headers per tab
const HEADERS = {
  sessions:   ['SessionID','Date','Course','Lecturer','LecturerEmail','StartedAt','EndsAt','Status','QRToken','QRExpiry','Settings','BLEActive','CreatedAt'],
  attendance: ['SessionID','Date','Course','StudentName','StudentEmail','Matric','CheckInTime','DeviceID','Distance','BLEVerified','Status','SpotResult','SubmittedAt'],
  qrLive:     ['SessionID','Token','Expiry','Course','Lat','Lng','GeoEnabled','GeoRadius','DeviceBinding','Selfie','BLE','PIN','Date','UpdatedAt'],
  audit:      ['Timestamp','Action','SessionID','UserEmail','Detail'],
};

// ─── Token management ────────────────────────────
function sheetsSetToken(token) {
  SHEETS.accessToken = token;
}

function sheetsSetEmail(email) {
  SHEETS.userEmail = email;
}

function sheetsIsReady() {
  return !!(SHEETS.accessToken && SHEETS.spreadsheetId);
}

// ─── Core API call ───────────────────────────────
async function sheetsAPI(method, path, body = null) {
  if (!SHEETS.accessToken) throw new Error('Not authenticated');
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${SHEETS.accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SHEETS_API}${path}`, opts);
  if (res.status === 401) {
    // Token expired — trigger re-auth
    throw new Error('TOKEN_EXPIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Spreadsheet bootstrap ───────────────────────

/**
 * Called once after lecturer signs in.
 * Looks for an existing SCHOOLER sheet in their Drive,
 * or creates a new one and sets up all tabs with headers.
 */
async function sheetsBootstrap(email) {
  SHEETS.userEmail = email;

  // Check localStorage for cached sheet ID for this email
  const cacheKey = `schooler_sheet_id_${email}`;
  const cached   = localStorage.getItem(cacheKey);

  if (cached) {
    // Verify it's still accessible
    try {
      await sheetsAPI('GET', `/${cached}?fields=spreadsheetId`);
      SHEETS.spreadsheetId = cached;
      return { spreadsheetId: cached, isNew: false };
    } catch(e) {
      // Sheet was deleted or lost access — create new one
      localStorage.removeItem(cacheKey);
    }
  }

  // Search Drive for existing SCHOOLER sheet
  const searchName = encodeURIComponent(`SCHOOLER Attendance — ${email}`);
  const searchRes  = await fetch(
    `${DRIVE_API}?q=name='SCHOOLER Attendance — ${email}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${SHEETS.accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    SHEETS.spreadsheetId = searchData.files[0].id;
    localStorage.setItem(cacheKey, SHEETS.spreadsheetId);
    return { spreadsheetId: SHEETS.spreadsheetId, isNew: false };
  }

  // Create a new spreadsheet
  const created = await sheetsAPI('POST', '', {
    properties: { title: `SCHOOLER Attendance — ${email}` },
    sheets: [
      { properties: { title: TAB.sessions } },
      { properties: { title: TAB.attendance } },
      { properties: { title: TAB.qrLive } },
      { properties: { title: TAB.audit } },
    ],
  });

  SHEETS.spreadsheetId = created.spreadsheetId;
  localStorage.setItem(cacheKey, SHEETS.spreadsheetId);

  // Write headers to all tabs
  await sheetsAPI('POST', `/${SHEETS.spreadsheetId}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: [
      { range: `${TAB.sessions}!A1`,   values: [HEADERS.sessions]   },
      { range: `${TAB.attendance}!A1`, values: [HEADERS.attendance] },
      { range: `${TAB.qrLive}!A1`,     values: [HEADERS.qrLive]     },
      { range: `${TAB.audit}!A1`,       values: [HEADERS.audit]       },
    ],
  });

  // Style header rows (blue background)
  const sheetIds = created.sheets.reduce((acc, s) => {
    acc[s.properties.title] = s.properties.sheetId; return acc;
  }, {});
  const headerRequests = Object.values(sheetIds).map(sheetId => ({
    repeatCell: {
      range:   { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell:    { userEnteredFormat: {
        backgroundColor: { red: 0.102, green: 0.424, blue: 1 },
        textFormat: { foregroundColor: { red:1, green:1, blue:1 }, bold: true },
      }},
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }));
  await sheetsAPI('POST', `/${SHEETS.spreadsheetId}:batchUpdate`, { requests: headerRequests });

  return { spreadsheetId: SHEETS.spreadsheetId, isNew: true };
}

/**
 * For students: they don't own the sheet.
 * The sheet ID is embedded in the QR payload / Sheets poll URL.
 * We store it temporarily for the session.
 */
function sheetsSetStudentSheetId(spreadsheetId) {
  SHEETS.spreadsheetId = spreadsheetId;
}

// ─── Append a row to a tab ───────────────────────
async function sheetsAppend(tab, values) {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  return sheetsAPI(
    'POST',
    `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [values] }
  );
}

// ─── Read all rows from a tab ────────────────────
async function sheetsRead(tab, range = 'A1:Z') {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  const res = await sheetsAPI('GET', `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(tab + '!' + range)}`);
  return res.values || [];
}

// ─── Update a specific cell range ────────────────
async function sheetsUpdate(range, values) {
  if (!sheetsIsReady()) throw new Error('Sheets not ready');
  return sheetsAPI(
    'PUT',
    `/${SHEETS.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { values }
  );
}

// ─── Find a row by column value ──────────────────
async function sheetsFindRow(tab, colIndex, value) {
  const rows = await sheetsRead(tab);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][colIndex] === value) return { rowIndex: i + 1, row: rows[i] };
  }
  return null;
}

// ═══════════════════════════════════════════════════
//  HIGH-LEVEL OPERATIONS (called by app.js)
// ═══════════════════════════════════════════════════

async function sheetsWriteSession(sessionBody) {
  await sheetsAppend(TAB.sessions, [
    sessionBody.sessionId,
    sessionBody.date,
    sessionBody.course,
    sessionBody.lecturer,
    sessionBody.lecturerEmail || SHEETS.userEmail || '',
    sessionBody.startedAt,
    sessionBody.endsAt,
    'active',
    '', '',               // QRToken, QRExpiry (filled by pushQRToken)
    sessionBody.settings,
    'false',
    new Date().toISOString(),
  ]);
  await sheetsAudit('writeSession', sessionBody.sessionId);
  return { ok: true };
}

async function sheetsUpdateSessionStatus(sessionId, status) {
  const found = await sheetsFindRow(TAB.sessions, 0, sessionId);
  if (!found) return { ok: false };
  // Col H = index 7 = status
  await sheetsUpdate(`${TAB.sessions}!H${found.rowIndex}`, [[status]]);
  if (status === 'ended') await sheetsClearQRLive();
  await sheetsAudit('endSession', sessionId);
  return { ok: true };
}

async function sheetsPushQRToken(body) {
  // Overwrite row 2 of QR_Live (single live row)
  const row = [
    body.sessionId, body.token, String(body.expiry),
    body.course,
    body.lat ?? '', body.lng ?? '',
    body.geo     ? 'true' : 'false',
    String(body.geoRadius || 50),
    body.device  ? 'true' : 'false',
    body.selfie  ? 'true' : 'false',
    body.ble     ? 'true' : 'false',
    body.pin || '',
    body.date || formatDateOnly(new Date()),
    new Date().toISOString(),
    // Also embed the spreadsheetId so students can discover the sheet
    SHEETS.spreadsheetId || '',
  ];

  // Ensure row 2 exists
  const existing = await sheetsRead(TAB.qrLive, 'A2:O2');
  if (!existing.length) {
    await sheetsAppend(TAB.qrLive, row);
  } else {
    await sheetsUpdate(`${TAB.qrLive}!A2:O2`, [row]);
  }

  // Also update Sessions sheet QRToken + QRExpiry columns
  const found = await sheetsFindRow(TAB.sessions, 0, body.sessionId);
  if (found) {
    await sheetsUpdate(`${TAB.sessions}!I${found.rowIndex}:J${found.rowIndex}`, [[body.token, String(body.expiry)]]);
  }
  return { ok: true };
}

async function sheetsPollQRToken() {
  // Students call this — reads row 2 of QR_Live
  if (!SHEETS.spreadsheetId) return { token: null };
  const rows = await sheetsRead(TAB.qrLive, 'A2:O2');
  if (!rows.length) return { token: null };
  const r = rows[0];
  const expiry = Number(r[2]);
  if (expiry && Date.now() > expiry + 5000) return { token: null, expired: true };
  return {
    sessionId:     r[0],
    token:         r[1],
    expiry,
    course:        r[3],
    lat:           r[4] || null,
    lng:           r[5] || null,
    geo:           r[6] === 'true',
    geoRadius:     Number(r[7]) || 50,
    device:        r[8] === 'true',
    selfie:        r[9] === 'true',
    ble:           r[10] === 'true',
    pin:           r[11],
    date:          r[12],
    spreadsheetId: r[14] || null,  // so students know which sheet to write to
  };
}

async function sheetsClearQRLive() {
  try {
    await sheetsUpdate(`${TAB.qrLive}!A2:O2`, [['','','','','','','','','','','','','','','']]);
  } catch(e) {}
}

async function sheetsAppendAttendance(record) {
  // Duplicate guard: read existing and check
  try {
    const rows = await sheetsRead(TAB.attendance);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === record.sessionId && rows[i][5] === record.matric) {
        return { ok: false, duplicate: true };
      }
    }
  } catch(e) {}

  await sheetsAppend(TAB.attendance, [
    record.sessionId,
    record.date || formatDateOnly(new Date(record.timestamp)),
    record.course,
    record.name,
    record.googleEmail || '',
    record.matric,
    new Date(record.timestamp).toLocaleTimeString('en-NG'),
    record.deviceId,
    record.distance ?? '',
    record.bleVerified ? 'Yes' : 'No',
    'present',
    '',
    new Date().toISOString(),
  ]);
  return { ok: true };
}

async function sheetsReadAttendance(sessionId) {
  const rows = await sheetsRead(TAB.attendance);
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === sessionId) {
      result.push({
        sessionId:   rows[i][0],
        date:        rows[i][1],
        course:      rows[i][2],
        studentName: rows[i][3],
        googleEmail: rows[i][4],
        matric:      rows[i][5],
        checkInTime: rows[i][6],
        deviceId:    rows[i][7],
        distance:    rows[i][8],
        bleVerified: rows[i][9] === 'Yes',
        status:      rows[i][10],
        spotResult:  rows[i][11],
      });
    }
  }
  return { rows: result };
}

async function sheetsUpdateSpotCheck(sessionId, matric, result) {
  const rows = await sheetsRead(TAB.attendance);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === sessionId && rows[i][5] === matric) {
      const rowNum = i + 1;
      await sheetsUpdate(`${TAB.attendance}!L${rowNum}`, [[result]]);
      if (result === 'absent') {
        await sheetsUpdate(`${TAB.attendance}!K${rowNum}`, [['flagged']]);
      }
      return { ok: true };
    }
  }
  return { ok: false };
}

async function sheetsUpdateBLEBeacon(sessionId, bleActive) {
  const found = await sheetsFindRow(TAB.sessions, 0, sessionId);
  if (!found) return { ok: false };
  await sheetsUpdate(`${TAB.sessions}!L${found.rowIndex}`, [[bleActive ? 'true' : 'false']]);
  return { ok: true };
}

// ─── Audit ───────────────────────────────────────
async function sheetsAudit(action, sessionId, detail = '') {
  try {
    await sheetsAppend(TAB.audit, [
      new Date().toISOString(), action, sessionId,
      SHEETS.userEmail || '', detail,
    ]);
  } catch(e) {}
}

// ─── Student polling ─────────────────────────────
function sheetsStartPolling(onNewToken) {
  if (SHEETS.pollInterval) clearInterval(SHEETS.pollInterval);
  SHEETS.pollInterval = setInterval(async () => {
    try {
      const data = await sheetsPollQRToken();
      if (!data || !data.token) return;
      // If student doesn't have spreadsheetId yet, pick it up from poll
      if (data.spreadsheetId && !SHEETS.spreadsheetId) {
        SHEETS.spreadsheetId = data.spreadsheetId;
      }
      if (data.token !== SHEETS.lastToken) {
        SHEETS.lastToken = data.token;
        onNewToken(data);
      }
    } catch(e) {}
  }, SHEETS.POLL_MS);
}

function sheetsStopPolling() {
  if (SHEETS.pollInterval) clearInterval(SHEETS.pollInterval);
  SHEETS.pollInterval = null;
  SHEETS.lastToken    = null;
}

// ─── Compat shims (called by app.js pushToSheets) ─
async function sheetsRequest(action, payload) {
  switch(action) {
    case 'ping':                return { ok: true };
    case 'writeSession':        return sheetsWriteSession(payload);
    case 'updateSessionStatus': return sheetsUpdateSessionStatus(payload.sessionId, payload.status);
    case 'pushQRToken':         return sheetsPushQRToken(payload);
    case 'pollQRToken':         return sheetsPollQRToken();
    case 'appendAttendance':    return sheetsAppendAttendance(payload);
    case 'readAttendance':      return sheetsReadAttendance(payload.sessionId);
    case 'updateSpotCheck':     return sheetsUpdateSpotCheck(payload.sessionId, payload.matric, payload.result);
    case 'updateBLEBeacon':     return sheetsUpdateBLEBeacon(payload.sessionId, payload.bleActive);
    default:                    throw new Error(`Unknown action: ${action}`);
  }
}

// Compat: sheetsGetUrl() was used as a "is Sheets connected?" check in app.js
function sheetsGetUrl() {
  return SHEETS.spreadsheetId || null;
}

// ─── Helpers ─────────────────────────────────────
function formatDateOnly(date) {
  return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}
