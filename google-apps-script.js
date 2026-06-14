/**
 * ══════════════════════════════════════════════════════
 *  SCHOOLER — Google Apps Script Backend  v1.2.0
 *
 *  SETUP INSTRUCTIONS:
 *  ────────────────────────────────────────────────────
 *  1. Go to https://script.google.com
 *  2. Click "New Project"
 *  3. Delete everything in the editor
 *  4. Paste this entire file
 *  5. Click Save (Ctrl+S)
 *  6. Click Deploy → New Deployment
 *  7. Type: Web App
 *  8. Execute as: Me
 *  9. Who has access: Anyone
 * 10. Click Deploy → Authorize → Allow
 * 11. Copy the Web App URL
 * 12. Paste it into SCHOOLER on first launch
 *
 *  SHEETS CREATED AUTOMATICALLY:
 *  ─────────────────────────────
 *  • Sessions    — one row per session
 *  • Attendance  — one row per student check-in
 *  • QR_Live     — single row, updated every 10s
 *  • Audit_Log   — all actions logged
 * ══════════════════════════════════════════════════════
 */

// ── Sheet name constants ──────────────────────────────
const SHEET_SESSIONS   = 'Sessions';
const SHEET_ATTENDANCE = 'Attendance';
const SHEET_QR_LIVE    = 'QR_Live';
const SHEET_AUDIT      = 'Audit_Log';

// ── Entry point — all requests come here ──────────────
function doPost(e) {
  const cors = buildCORS();
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'ping':                result = { ok: true, version: '1.2.0', ts: Date.now() };  break;
      case 'writeSession':        result = writeSession(body);        break;
      case 'updateSessionStatus': result = updateSessionStatus(body); break;
      case 'pushQRToken':         result = pushQRToken(body);         break;
      case 'pollQRToken':         result = pollQRToken();             break;
      case 'appendAttendance':    result = appendAttendance(body);    break;
      case 'readAttendance':      result = readAttendance(body);      break;
      case 'updateSpotCheck':     result = updateSpotCheck(body);     break;
      case 'updateBLEBeacon':     result = updateBLEBeacon(body);     break;
      default:
        result = { error: `Unknown action: ${action}` };
    }

    auditLog(action, body.sessionId || '', JSON.stringify(result).slice(0, 200));
    return buildResponse(result, cors);

  } catch (err) {
    auditLog('ERROR', '', err.message);
    return buildResponse({ error: err.message }, cors);
  }
}

// Handle preflight OPTIONS (CORS)
function doGet(e) {
  return buildResponse({ ok: true, message: 'SCHOOLER API is running' }, buildCORS());
}

// ── Sessions ──────────────────────────────────────────

function writeSession(body) {
  const sheet = getOrCreateSheet(SHEET_SESSIONS, [
    'SessionID','Date','Course','Lecturer','StartedAt','EndsAt',
    'Status','QRToken','QRExpiry','Settings','BLEActive','CreatedAt'
  ]);

  // Check for duplicate
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId) {
      // Update existing row status
      sheet.getRange(i + 1, 8).setValue('');    // clear token
      sheet.getRange(i + 1, 7).setValue('active');
      return { ok: true, updated: true };
    }
  }

  sheet.appendRow([
    body.sessionId, body.date, body.course, body.lecturer,
    body.startedAt, body.endsAt, 'active',
    '', '', body.settings || '', false,
    new Date().toISOString()
  ]);
  return { ok: true, created: true };
}

function updateSessionStatus(body) {
  const sheet = getOrCreateSheet(SHEET_SESSIONS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId) {
      sheet.getRange(i + 1, 7).setValue(body.status);
      // If ending, clear QR_Live
      if (body.status === 'ended') clearQRLive();
      return { ok: true };
    }
  }
  return { ok: false, error: 'Session not found' };
}

// ── QR Live Token ─────────────────────────────────────

function pushQRToken(body) {
  const sheet = getOrCreateSheet(SHEET_QR_LIVE, [
    'SessionID','Token','Expiry','Course','Lat','Lng',
    'GeoEnabled','GeoRadius','DeviceBinding','Selfie',
    'BLE','PIN','Date','UpdatedAt'
  ]);

  // Always overwrite row 2 (single live token row)
  const row = [
    body.sessionId, body.token, body.expiry,
    body.course, body.lat || '', body.lng || '',
    body.geo ? 'true' : 'false',
    body.geoRadius || 50,
    body.device ? 'true' : 'false',
    body.selfie  ? 'true' : 'false',
    body.ble     ? 'true' : 'false',
    body.pin || '',
    body.date || formatDate(new Date()),
    new Date().toISOString()
  ];

  if (sheet.getLastRow() < 2) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
  }

  // Also update the Sessions sheet with current token
  const sessSheet = getOrCreateSheet(SHEET_SESSIONS);
  const data = sessSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId) {
      sessSheet.getRange(i + 1, 8).setValue(body.token);
      sessSheet.getRange(i + 1, 9).setValue(body.expiry);
      break;
    }
  }

  return { ok: true };
}

function pollQRToken() {
  const sheet = getOrCreateSheet(SHEET_QR_LIVE);
  if (sheet.getLastRow() < 2) return { token: null };

  const row     = sheet.getRange(2, 1, 1, 14).getValues()[0];
  const expiry  = Number(row[2]);

  // Return null if token is expired
  if (expiry && Date.now() > expiry + 5000) {
    return { token: null, expired: true };
  }

  return {
    sessionId:  row[0],
    token:      row[1],
    expiry:     expiry,
    course:     row[3],
    lat:        row[4] || null,
    lng:        row[5] || null,
    geo:        row[6] === 'true',
    geoRadius:  Number(row[7]) || 50,
    device:     row[8] === 'true',
    selfie:     row[9] === 'true',
    ble:        row[10] === 'true',
    pin:        row[11],
    date:       row[12],
    updatedAt:  row[13],
  };
}

function clearQRLive() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QR_LIVE);
    if (sheet && sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, 1, 14).clearContent();
    }
  } catch(e) {}
}

// ── Attendance ────────────────────────────────────────

function appendAttendance(body) {
  const sheet = getOrCreateSheet(SHEET_ATTENDANCE, [
    'SessionID','Date','Course','StudentName','Matric',
    'CheckInTime','DeviceID','Distance','BLEVerified',
    'Status','SpotResult','SubmittedAt'
  ]);

  // Duplicate guard: same matric + same sessionId
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId && data[i][4] === body.matric) {
      return { ok: false, duplicate: true, message: 'Already recorded' };
    }
  }

  sheet.appendRow([
    body.sessionId,
    body.date || formatDate(new Date()),
    body.course,
    body.studentName,
    body.matric,
    body.checkInTime || new Date().toLocaleTimeString(),
    body.deviceId,
    body.distance || '',
    body.bleVerified ? 'Yes' : 'No',
    'present',
    '',
    new Date().toISOString()
  ]);

  return { ok: true };
}

function readAttendance(body) {
  const sheet = getOrCreateSheet(SHEET_ATTENDANCE);
  if (sheet.getLastRow() < 2) return { rows: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId) {
      const row = {};
      headers.forEach((h, j) => { row[h.replace(/\s/g,'')] = data[i][j]; });
      rows.push({
        sessionId:   data[i][0],
        date:        data[i][1],
        course:      data[i][2],
        studentName: data[i][3],
        matric:      data[i][4],
        checkInTime: data[i][5],
        deviceId:    data[i][6],
        distance:    data[i][7],
        bleVerified: data[i][8] === 'Yes',
        status:      data[i][9],
        spotResult:  data[i][10],
      });
    }
  }
  return { rows };
}

function updateSpotCheck(body) {
  const sheet = getOrCreateSheet(SHEET_ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId && data[i][4] === body.matric) {
      sheet.getRange(i + 1, 11).setValue(body.result);
      if (body.result === 'absent') {
        sheet.getRange(i + 1, 10).setValue('flagged');
      }
      return { ok: true };
    }
  }
  return { ok: false, error: 'Record not found' };
}

function updateBLEBeacon(body) {
  const sheet = getOrCreateSheet(SHEET_SESSIONS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.sessionId) {
      sheet.getRange(i + 1, 11).setValue(body.bleActive ? 'true' : 'false');
      return { ok: true };
    }
  }
  return { ok: false };
}

// ── Audit Log ─────────────────────────────────────────

function auditLog(action, sessionId, detail) {
  try {
    const sheet = getOrCreateSheet(SHEET_AUDIT, ['Timestamp','Action','SessionID','Detail']);
    sheet.appendRow([new Date().toISOString(), action, sessionId, detail]);
  } catch(e) {}
}

// ── Utility helpers ───────────────────────────────────

function getOrCreateSheet(name, headers) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1a6cff')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
}

function buildResponse(data, cors) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function buildCORS() {
  // Apps Script doesn't support custom CORS headers in ContentService
  // but the fetch from the app uses text/plain to avoid preflight.
  return {};
}
