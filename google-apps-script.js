/**
 * SCHOOLER — Google Apps Script Backend v2.0
 * ═══════════════════════════════════════════
 * 
 * This script runs as YOU (the lecturer) and accepts
 * requests from anyone — no OAuth needed for students.
 * 
 * DEPLOY ONCE:
 * ────────────
 * 1. Open https://script.google.com
 * 2. New project → paste this entire file → Save
 * 3. Deploy → New Deployment → Web App
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Authorize → Copy the /exec URL
 * 5. Paste into SCHOOLER when prompted on first sign-in
 * 
 * That's it. Students never need Google accounts.
 * The script auto-creates your spreadsheet.
 */

// ── Sheet tab names ───────────────────────────────
const S = {
  sessions:   'Sessions',
  attendance: 'Attendance',
  qrLive:     'QR_Live',
  log:        'Log',
};

// ── CORS headers ──────────────────────────────────
function cors() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry point ───────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'ping':            result = ping();                    break;
      case 'getSheetId':      result = getSheetId();             break;
      case 'writeSession':    result = writeSession(body);        break;
      case 'endSession':      result = endSession(body);          break;
      case 'pushQRToken':     result = pushQRToken(body);         break;
      case 'pollQRToken':     result = pollQRToken();             break;
      case 'submitAttendance':result = submitAttendance(body);    break;
      case 'getAttendance':   result = getAttendance(body);       break;
      case 'spotCheck':       result = updateSpotCheck(body);     break;
      default: result = { ok: false, error: 'Unknown action: ' + action };
    }

    log_(action, body.sessionId || '', JSON.stringify(result).slice(0, 300));
    return out(result);

  } catch(err) {
    log_('ERROR', '', err.message);
    return out({ ok: false, error: err.message });
  }
}

function doGet() {
  return out({ ok: true, app: 'SCHOOLER', version: '2.0' });
}

// ── ping ──────────────────────────────────────────
function ping() {
  const ss = getOrCreateSpreadsheet_();
  return { ok: true, spreadsheetId: ss.getId(), version: '2.0' };
}

// ── getSheetId — lecturer calls after sign-in ─────
function getSheetId() {
  const ss = getOrCreateSpreadsheet_();
  return { ok: true, spreadsheetId: ss.getId() };
}

// ── writeSession ──────────────────────────────────
function writeSession(b) {
  const sheet = tab_(S.sessions);
  // Avoid duplicate session rows
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === b.sessionId) return { ok: true, existing: true };
  }
  sheet.appendRow([
    b.sessionId, b.date, b.course, b.lecturer,
    b.lecturerEmail || '', b.startedAt, b.endsAt,
    'active', b.settings || '',
    new Date().toISOString(),
  ]);
  return { ok: true };
}

// ── endSession ────────────────────────────────────
function endSession(b) {
  const sheet = tab_(S.sessions);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === b.sessionId) {
      sheet.getRange(i + 1, 8).setValue('ended');
      break;
    }
  }
  // Clear QR_Live row 2
  const ql = tab_(S.qrLive);
  if (ql.getLastRow() >= 2) ql.getRange(2, 1, 1, 15).clearContent();
  return { ok: true };
}

// ── pushQRToken — overwrites single live row ──────
function pushQRToken(b) {
  const sheet = tab_(S.qrLive);
  const row   = [
    b.sessionId, b.token, b.expiry, b.course,
    b.spreadsheetId || '',
    b.lat || '', b.lng || '',
    b.geo    ? '1' : '0',
    b.geoRadius || 50,
    b.device ? '1' : '0',
    b.selfie ? '1' : '0',
    b.ble    ? '1' : '0',
    b.pin    || '',
    b.date   || '',
    new Date().toISOString(),
  ];
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
  }
  return { ok: true };
}

// ── pollQRToken — students call every 3s ──────────
function pollQRToken() {
  const sheet = tab_(S.qrLive);
  if (sheet.getLastRow() < 2) return { ok: true, token: null };

  const r      = sheet.getRange(2, 1, 1, 15).getValues()[0];
  const expiry = Number(r[2]);

  if (!r[0] || !r[1]) return { ok: true, token: null };
  if (expiry && Date.now() > expiry + 5000) return { ok: true, token: null, expired: true };

  return {
    ok: true,
    sessionId:     String(r[0]),
    token:         String(r[1]),
    expiry:        expiry,
    course:        String(r[3]),
    spreadsheetId: String(r[4]),
    lat:           r[5] ? Number(r[5]) : null,
    lng:           r[6] ? Number(r[6]) : null,
    geo:           r[7] === '1',
    geoRadius:     Number(r[8]) || 50,
    device:        r[9] === '1',
    selfie:        r[10] === '1',
    ble:           r[11] === '1',
    pin:           String(r[12]),
    date:          String(r[13]),
  };
}

// ── submitAttendance — student submits check-in ───
function submitAttendance(b) {
  const sheet = tab_(S.attendance);
  const data  = sheet.getDataRange().getValues();

  // Duplicate guard: same sessionId + deviceId OR sessionId + matric
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== b.sessionId) continue;
    if (data[i][6] === b.deviceId)  return { ok: false, duplicate: true, reason: 'device' };
    if (data[i][5] === b.matric)    return { ok: false, duplicate: true, reason: 'matric' };
  }

  const now = new Date();
  sheet.appendRow([
    b.sessionId,
    b.date || Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd-MMM-yyyy'),
    b.course,
    b.name,
    b.googleEmail || '',
    b.matric,
    b.deviceId,
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    now.toISOString(),
    b.distance || '',
    b.bleVerified ? 'Yes' : 'No',
    'present',
    '',
  ]);
  return { ok: true };
}

// ── getAttendance — lecturer polls for new rows ───
function getAttendance(b) {
  const sheet = tab_(S.attendance);
  if (sheet.getLastRow() < 2) return { ok: true, rows: [] };

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== b.sessionId) continue;
    rows.push({
      sessionId:   String(data[i][0]),
      date:        String(data[i][1]),
      course:      String(data[i][2]),
      studentName: String(data[i][3]),
      googleEmail: String(data[i][4]),
      matric:      String(data[i][5]),
      deviceId:    String(data[i][6]),
      checkInTime: String(data[i][7]),
      checkInISO:  String(data[i][8]),
      distance:    data[i][9] ? Number(data[i][9]) : null,
      bleVerified: data[i][10] === 'Yes',
      status:      String(data[i][11] || 'present'),
      spotResult:  String(data[i][12] || ''),
    });
  }
  return { ok: true, rows };
}

// ── updateSpotCheck ───────────────────────────────
function updateSpotCheck(b) {
  const sheet = tab_(S.attendance);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === b.sessionId && data[i][5] === b.matric) {
      sheet.getRange(i + 1, 13).setValue(b.result);
      if (b.result === 'absent') sheet.getRange(i + 1, 12).setValue('flagged');
      return { ok: true };
    }
  }
  return { ok: false, error: 'Record not found' };
}

// ── Spreadsheet bootstrap ─────────────────────────
function getOrCreateSpreadsheet_() {
  const key  = 'SCHOOLER_SPREADSHEET_ID';
  const prop = PropertiesService.getScriptProperties();
  let   id   = prop.getProperty(key);

  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) { prop.deleteProperty(key); }
  }

  // Create new spreadsheet
  const ss = SpreadsheetApp.create('SCHOOLER Attendance');
  id = ss.getId();
  prop.setProperty(key, id);

  // Rename the default sheet and add the rest
  const sheets = ss.getSheets();
  sheets[0].setName(S.sessions);
  ss.insertSheet(S.attendance);
  ss.insertSheet(S.qrLive);
  ss.insertSheet(S.log);

  // Write headers
  const hdrs = {
    [S.sessions]:   ['SessionID','Date','Course','Lecturer','LecturerEmail','StartedAt','EndsAt','Status','Settings','CreatedAt'],
    [S.attendance]: ['SessionID','Date','Course','StudentName','StudentEmail','Matric','DeviceID','CheckInTime','CheckInISO','Distance','BLEVerified','Status','SpotResult'],
    [S.qrLive]:     ['SessionID','Token','Expiry','Course','SpreadsheetID','Lat','Lng','Geo','GeoRadius','Device','Selfie','BLE','PIN','Date','UpdatedAt'],
    [S.log]:        ['Timestamp','Action','SessionID','Detail'],
  };
  Object.entries(hdrs).forEach(([name, hdr]) => {
    const s = ss.getSheetByName(name);
    s.getRange(1, 1, 1, hdr.length).setValues([hdr])
      .setBackground('#1a6cff').setFontColor('#ffffff').setFontWeight('bold');
    s.setFrozenRows(1);
  });

  return ss;
}

function tab_(name) {
  const ss    = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab not found: ' + name);
  return sheet;
}

function log_(action, sessionId, detail) {
  try {
    tab_(S.log).appendRow([new Date().toISOString(), action, sessionId, detail]);
  } catch(e) {}
}

function out(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
