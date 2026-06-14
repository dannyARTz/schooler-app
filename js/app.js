/* ══════════════════════════════════════════════════
   SCHOOLER — Main App Logic  v1.2.0
   
   New in this version:
   ✦ Google Sheets as live backend (no database)
   ✦ QR tokens synced to Sheets every 10s
   ✦ Students poll Sheets for live tokens (cross-device)
   ✦ BLE beacon (lecturer) + proximity scan (student)
   ✦ Device-seen-today tracking (resets each new day)
   ✦ Duplicate scan message instead of hard block
   ✦ Date stamped on all records
   ✦ Sessions auto-expire and archive per day
   ✦ Selfie capture flow
══════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
const STATE = {
  role: null,
  user: null,
  session: null,
  attendance: [],
  studentHistory: [],
  offlineQueue: [],
  qrInterval: null,
  sessionTimer: null,
  scanActive: false,
  scanStream: null,
  scanAnimFrame: null,
  selfieStream: null,
  theme: 'dark',
  isOnline: navigator.onLine,
  deviceId: null,
  sheetsConnected: false,
  lastSheetsPush: null,
  bleBeaconActive: false,
  // Cached token from Sheets polling (student side)
  liveSheetToken: null,
};

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const QR_REFRESH_SECS = 10;
const APP_VERSION     = '1.2.0';
const STORAGE_KEY     = 'schooler_state_v2';
const SPOT_CHECK_PCT  = 0.05;

// ═══════════════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const DOM = {
  splash:               $('splash'),
  // Setup modal
  sheetsSetupModal:     $('sheetsSetupModal'),
  sheetsUrlInput:       $('sheetsUrlInput'),
  sheetsConnectBtn:     $('sheetsConnectBtn'),
  sheetsSkipBtn:        $('sheetsSkipBtn'),
  sheetsTestStatus:     $('sheetsTestStatus'),
  sheetsIndicator:      $('sheetsIndicator'),
  sheetsIndicatorText:  $('sheetsIndicatorText'),
  sheetsSyncBadge:      $('sheetsSyncBadge'),
  sheetsSyncText:       $('sheetsSyncText'),
  sheetsSyncStatus:     $('sheetsSyncStatus'),
  sheetsPollingBar:     $('sheetsPollingBar'),
  // Auth
  authScreen:           $('authScreen'),
  authName:             $('authName'),
  authMatric:           $('authMatric'),
  authCourse:           $('authCourse'),
  authDept:             $('authDept'),
  authBtn:              $('authBtn'),
  matricGroup:          $('matricGroup'),
  courseGroup:          $('courseGroup'),
  deptGroup:            $('deptGroup'),
  deviceWarning:        $('deviceWarning'),
  roleTabs:             document.querySelectorAll('.role-tab'),
  // Dashboards
  lecturerDash:         $('lecturerDashboard'),
  studentDash:          $('studentDashboard'),
  // Stats
  statTotal:            $('statTotal'),
  statRate:             $('statRate'),
  statFlagged:          $('statFlagged'),
  statSession:          $('statSession'),
  // Settings
  settingQR:            $('settingQR'),
  settingDevice:        $('settingDevice'),
  settingSpotCheck:     $('settingSpotCheck'),
  settingGeo:           $('settingGeo'),
  settingBLE:           $('settingBLE'),
  settingSelfie:        $('settingSelfie'),
  geoRadiusField:       $('geoRadiusField'),
  geoRadius:            $('geoRadius'),
  // Session
  sessionCourse:        $('sessionCourse'),
  sessionDuration:      $('sessionDuration'),
  startSessionBtn:      $('startSessionBtn'),
  endSessionBtn:        $('endSessionBtn'),
  startSessionArea:     $('startSessionArea'),
  activeSessionArea:    $('activeSessionArea'),
  sessionStatusBadge:   $('sessionStatusBadge'),
  // QR display
  qrCanvas:             $('qrCanvas'),
  countdownNum:         $('countdownNum'),
  qrSessionCode:        $('qrSessionCode'),
  qrWrapper:            document.querySelector('.qr-wrapper'),
  // Active info
  activeCourseName:     $('activeCourseName'),
  activeSessionDate:    $('activeSessionDate'),
  activeStartTime:      $('activeStartTime'),
  activeTimeLeft:       $('activeTimeLeft'),
  geoStatusDisplay:     $('geoStatusDisplay'),
  activeChecksDisplay:  $('activeChecksDisplay'),
  activePIN:            $('activePIN'),
  // BLE beacon
  bleBeaconBtn:         $('bleBeaconBtn'),
  bleBeaconText:        $('bleBeaconText'),
  // Spot check
  spotCheckPanel:       $('spotCheckPanel'),
  spotCheckList:        $('spotCheckList'),
  triggerSpotCheckBtn:  $('triggerSpotCheckBtn'),
  // Table
  attendanceBody:       $('attendanceBody'),
  exportBtn:            $('exportBtn'),
  clearAttendanceBtn:   $('clearAttendanceBtn'),
  // Student
  studentName:          $('studentName'),
  studentMatricDisplay: $('studentMatricDisplay'),
  deviceChip:           $('deviceChip'),
  offlineQueueBanner:   $('offlineQueueBanner'),
  spotCheckNotification:$('spotCheckNotification'),
  scannerVideo:         $('scannerVideo'),
  scannerCanvas:        $('scannerCanvas'),
  startScanBtn:         $('startScanBtn'),
  scanHint:             $('scanHint'),
  scanSubtitle:         $('scanSubtitle'),
  scanCard:             $('scanCard'),
  statusCard:           $('statusCard'),
  statusIcon:           $('statusIcon'),
  statusTitle:          $('statusTitle'),
  statusMsg:            $('statusMsg'),
  statusMeta:           $('statusMeta'),
  scanAgainBtn:         $('scanAgainBtn'),
  manualCode:           $('manualCode'),
  manualSubmitBtn:      $('manualSubmitBtn'),
  historyList:          $('historyList'),
  historyRate:          $('historyRate'),
  // Selfie
  selfieModal:          $('selfieModal'),
  selfieVideo:          $('selfieVideo'),
  selfieCanvas:         $('selfieCanvas'),
  selfieCaptureBtn:     $('selfieCaptureBtn'),
  selfieCancelBtn:      $('selfieCancelBtn'),
  // Network
  offlineBadge:         $('offlineBadge'),
  offlineBadgeStudent:  $('offlineBadgeStudent'),
  // UI
  toast:                $('toast'),
  modal:                $('modal'),
  modalTitle:           $('modalTitle'),
  modalMsg:             $('modalMsg'),
  modalCancel:          $('modalCancel'),
  modalConfirm:         $('modalConfirm'),
  themeToggle:          $('themeToggle'),
  themeToggleStudent:   $('themeToggleStudent'),
  themeIconDark:        $('themeIconDark'),
  themeIconLight:       $('themeIconLight'),
  lecturerLogout:       $('lecturerLogout'),
  studentLogout:        $('studentLogout'),
};

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initDeviceId();
  initNetworkListeners();
  updateSheetsIndicator();
  setTimeout(bootApp, 1900);
});

function bootApp() {
  DOM.splash.classList.add('fade-out');
  setTimeout(() => {
    DOM.splash.style.display = 'none';
    const saved = loadSavedState();
    if (saved) {
      restoreSession(saved);
    } else {
      // First run — show Sheets setup
      const hasUrl = !!sheetsGetUrl();
      if (!hasUrl) {
        DOM.sheetsSetupModal.classList.remove('hidden');
      } else {
        STATE.sheetsConnected = true;
        updateSheetsIndicator();
        showScreen('auth');
      }
    }
  }, 400);
}

// ═══════════════════════════════════════════════════════
//  GOOGLE SHEETS SETUP
// ═══════════════════════════════════════════════════════
DOM.sheetsIndicator.addEventListener('click', () => {
  DOM.sheetsSetupModal.classList.remove('hidden');
  DOM.sheetsUrlInput.value = sheetsGetUrl() || '';
});

DOM.sheetsSkipBtn.addEventListener('click', () => {
  DOM.sheetsSetupModal.classList.add('hidden');
  STATE.sheetsConnected = false;
  updateSheetsIndicator();
  showScreen('auth');
});

DOM.sheetsConnectBtn.addEventListener('click', async () => {
  const url = DOM.sheetsUrlInput.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    showSheetsTestStatus('Please paste a valid Apps Script URL', false);
    return;
  }
  DOM.sheetsConnectBtn.textContent = 'Testing…';
  DOM.sheetsConnectBtn.disabled    = true;
  try {
    sheetsInit(url);
    const result = await sheetsRequest('ping', {});
    if (result && result.ok) {
      showSheetsTestStatus('Connected successfully! Sheets is ready.', true);
      STATE.sheetsConnected = true;
      updateSheetsIndicator();
      setTimeout(() => {
        DOM.sheetsSetupModal.classList.add('hidden');
        showScreen('auth');
      }, 1200);
    } else {
      throw new Error('Unexpected response');
    }
  } catch(e) {
    showSheetsTestStatus(`Connection failed: ${e.message}. Check the URL and try again.`, false);
  } finally {
    DOM.sheetsConnectBtn.textContent = 'Connect';
    DOM.sheetsConnectBtn.disabled    = false;
  }
});

function showSheetsTestStatus(msg, ok) {
  DOM.sheetsTestStatus.textContent  = ok ? '✓ ' + msg : '✗ ' + msg;
  DOM.sheetsTestStatus.className    = `sheets-test-status ${ok ? 'ok' : 'error'}`;
  DOM.sheetsTestStatus.classList.remove('hidden');
}

function updateSheetsIndicator() {
  const connected = STATE.sheetsConnected || !!sheetsGetUrl();
  DOM.sheetsIndicator.classList.toggle('connected', connected);
  DOM.sheetsIndicatorText.textContent = connected ? '✓ Sheets connected' : 'Not connected — click to setup';
  // Navbar badge
  if (DOM.sheetsSyncBadge) {
    DOM.sheetsSyncBadge.classList.toggle('synced', connected);
    if (DOM.sheetsSyncText) DOM.sheetsSyncText.textContent = connected ? '✓ Sheets' : 'Sheets';
  }
}

async function pushToSheets(action, payload) {
  if (!sheetsGetUrl()) return null;
  try {
    setSyncStatus('syncing');
    const result = await sheetsRequest(action, payload);
    setSyncStatus('ok');
    return result;
  } catch(e) {
    setSyncStatus('error');
    console.warn('[Sheets]', action, e.message);
    return null;
  }
}

function setSyncStatus(status) {
  if (!DOM.sheetsSyncBadge) return;
  DOM.sheetsSyncBadge.className = `sheets-badge ${status}`;
  const labels = { syncing: '⟳ Syncing', ok: '✓ Sheets', error: '✗ Sheets', '': 'Sheets' };
  if (DOM.sheetsSyncText) DOM.sheetsSyncText.textContent = labels[status] || 'Sheets';
  if (DOM.sheetsSyncStatus) {
    DOM.sheetsSyncStatus.innerHTML = {
      syncing: '<span class="sync-idle">Syncing…</span>',
      ok:      `<span class="sync-ok">✓ Last sync ${formatTime(new Date())}</span>`,
      error:   '<span class="sync-err">✗ Sync failed (offline?)</span>',
    }[status] || '—';
  }
}

// ═══════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════
function loadTheme() {
  applyTheme(localStorage.getItem('schooler_theme') || 'dark');
}
function applyTheme(theme) {
  STATE.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('schooler_theme', theme);
  const isDark = theme === 'dark';
  DOM.themeIconDark.style.display  = isDark ? 'block' : 'none';
  DOM.themeIconLight.style.display = isDark ? 'none'  : 'block';
}
function toggleTheme() { applyTheme(STATE.theme === 'dark' ? 'light' : 'dark'); }
DOM.themeToggle.addEventListener('click', toggleTheme);
DOM.themeToggleStudent.addEventListener('click', toggleTheme);

// ═══════════════════════════════════════════════════════
//  NETWORK
// ═══════════════════════════════════════════════════════
function initNetworkListeners() {
  window.addEventListener('online',  () => { STATE.isOnline = true;  updateOfflineUI(); syncOfflineQueue(); });
  window.addEventListener('offline', () => { STATE.isOnline = false; updateOfflineUI(); });
  updateOfflineUI();
}
function updateOfflineUI() {
  const off = !STATE.isOnline;
  DOM.offlineBadge?.classList.toggle('hidden', !off);
  DOM.offlineBadgeStudent?.classList.toggle('hidden', !off);
  DOM.offlineQueueBanner?.classList.toggle('hidden', STATE.offlineQueue.length === 0 || STATE.isOnline);
}
function queueOfflineRecord(record) {
  STATE.offlineQueue.push(record);
  saveStateSnapshot();
  updateOfflineUI();
}
async function syncOfflineQueue() {
  if (!STATE.isOnline || !STATE.offlineQueue.length) return;
  const toSync = [...STATE.offlineQueue];
  STATE.offlineQueue = [];
  for (const record of toSync) {
    try {
      await sheetsAppendAttendance(record);
    } catch(e) {
      STATE.offlineQueue.push(record); // re-queue on failure
    }
  }
  saveStateSnapshot();
  updateOfflineUI();
  if (!STATE.offlineQueue.length) showToast('Offline records synced to Sheets', 'success');
}

// ═══════════════════════════════════════════════════════
//  DEVICE FINGERPRINT / DAILY BINDING
// ═══════════════════════════════════════════════════════
function initDeviceId() {
  let id = localStorage.getItem('schooler_device_id');
  if (!id) {
    id = generateId(24) + '_' + (navigator.platform || 'web').replace(/\s/g,'').slice(0,6);
    localStorage.setItem('schooler_device_id', id);
  }
  STATE.deviceId = id;
}
function getDeviceShort() {
  return STATE.deviceId ? STATE.deviceId.slice(0, 8).toUpperCase() : 'UNKNOWN';
}

/**
 * Returns true if this device has already scanned for
 * this matric+sessionId combo today.
 * Key format: schooler_seen_{matric}_{sessionId}_{YYYY-MM-DD}
 */
function hasSeenTodayForSession(matric, sessionId) {
  const key = `schooler_seen_${matric}_${sessionId}_${todayKey()}`;
  return localStorage.getItem(key) === STATE.deviceId;
}
function markSeenTodayForSession(matric, sessionId) {
  const key = `schooler_seen_${matric}_${sessionId}_${todayKey()}`;
  localStorage.setItem(key, STATE.deviceId);
  // Also track device binding per matric
  const bindKey = `schooler_device_bind_${matric}`;
  if (!localStorage.getItem(bindKey)) {
    localStorage.setItem(bindKey, STATE.deviceId);
  }
}
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function checkDeviceBinding(matric) {
  const key   = `schooler_device_bind_${matric}`;
  const bound = localStorage.getItem(key);
  if (!bound) return { bound: true, isNewBind: true };
  if (bound === STATE.deviceId) return { bound: true, isNewBind: false };
  const lastChange    = localStorage.getItem(`schooler_device_change_${matric}`);
  const daysSince     = lastChange ? (Date.now() - parseInt(lastChange)) / 86400000 : 999;
  return { bound: false, isNewBind: false, daysSince };
}
function bindDevice(matric) {
  localStorage.setItem(`schooler_device_bind_${matric}`, STATE.deviceId);
  localStorage.setItem(`schooler_device_change_${matric}`, Date.now().toString());
}

// ═══════════════════════════════════════════════════════
//  SCREEN ROUTING
// ═══════════════════════════════════════════════════════
function showScreen(name) {
  DOM.authScreen.classList.add('hidden');
  DOM.lecturerDash.classList.add('hidden');
  DOM.studentDash.classList.add('hidden');
  if (name === 'auth')     DOM.authScreen.classList.remove('hidden');
  if (name === 'lecturer') DOM.lecturerDash.classList.remove('hidden');
  if (name === 'student')  DOM.studentDash.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
DOM.settingGeo.addEventListener('change', () => {
  DOM.geoRadiusField.classList.toggle('hidden', !DOM.settingGeo.checked);
});

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
let selectedRole = 'lecturer';
DOM.roleTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.roleTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedRole = tab.dataset.role;
    DOM.deviceWarning.classList.add('hidden');
    updateAuthForm();
  });
});
DOM.authName.addEventListener('blur', checkDeviceWarningUI);
DOM.authMatric.addEventListener('blur', checkDeviceWarningUI);

function checkDeviceWarningUI() {
  if (selectedRole !== 'student') return;
  const matric = DOM.authMatric.value.trim();
  if (!matric) return;
  const check = checkDeviceBinding(matric);
  DOM.deviceWarning.classList.toggle('hidden', check.bound !== false);
}

function updateAuthForm() {
  if (selectedRole === 'student') {
    DOM.matricGroup.style.display = '';
    DOM.courseGroup.style.display = '';
    DOM.deptGroup.style.display   = 'none';
    DOM.authName.placeholder      = 'e.g. Chiamaka Obi';
    DOM.authCourse.placeholder    = 'e.g. CSC 325';
    DOM.authBtn.textContent       = 'Join as Student';
  } else {
    DOM.matricGroup.style.display = 'none';
    DOM.courseGroup.style.display = '';
    DOM.deptGroup.style.display   = '';
    DOM.authName.placeholder      = 'e.g. Dr. Emeka Okafor';
    DOM.authCourse.placeholder    = 'e.g. CSC 325';
    DOM.authBtn.textContent       = 'Enter as Lecturer';
  }
}

DOM.authBtn.addEventListener('click', handleAuth);
function handleAuth() {
  const name   = DOM.authName.value.trim();
  const course = DOM.authCourse.value.trim();
  const dept   = DOM.authDept.value.trim();
  const matric = DOM.authMatric.value.trim();

  if (!name)   { showToast('Please enter your name', 'error'); return; }
  if (!course) { showToast('Please enter a course code', 'error'); return; }
  if (selectedRole === 'student' && !matric) { showToast('Please enter your matric number', 'error'); return; }

  if (selectedRole === 'student') {
    const check = checkDeviceBinding(matric);
    if (!check.bound) {
      if (check.daysSince < 30) {
        showToast(`Device switch pending. Next change in ${Math.ceil(30 - check.daysSince)} days.`, 'error');
        return;
      }
      bindDevice(matric);
    }
    if (check.isNewBind) bindDevice(matric);
  }

  STATE.role = selectedRole;
  STATE.user = { name, course, dept, matric };
  saveStateSnapshot();

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = course;
    renderAttendanceTable();
    updateStats();
    showScreen('lecturer');
    showToast(`Welcome, ${name}`, 'success');
  } else {
    DOM.studentName.textContent          = name;
    DOM.studentMatricDisplay.textContent = matric ? `${matric} · ${course}` : course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    renderStudentHistory();
    // If Sheets connected, start polling for live QR
    if (sheetsGetUrl()) startSheetsPoll();
    showScreen('student');
    syncOfflineQueue();
    showToast(`Welcome, ${name}`, 'success');
  }
}

DOM.lecturerLogout.addEventListener('click', () => {
  confirmModal('Sign out?', 'This will end any active session.', () => {
    endSession(true);
    bleStopBeacon();
    clearSavedState();
    STATE.role = null; STATE.user = null;
    showScreen('auth');
  });
});
DOM.studentLogout.addEventListener('click', () => {
  stopScanner();
  sheetsStopPolling();
  clearSavedState();
  STATE.role = null; STATE.user = null;
  showScreen('auth');
});

// ═══════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════
DOM.startSessionBtn.addEventListener('click', startSession);
DOM.endSessionBtn.addEventListener('click', () => {
  confirmModal('End Session?', 'Students can no longer check in. Records stay in Sheets.', () => endSession(false));
});

async function startSession() {
  const course   = DOM.sessionCourse.value.trim();
  const duration = parseInt(DOM.sessionDuration.value) || 60;
  const useGeo   = DOM.settingGeo.checked;
  const useBLE   = DOM.settingBLE.checked;
  const geoR     = parseInt(DOM.geoRadius.value) || 50;

  if (!course) { showToast('Enter a course code', 'error'); return; }

  let coords = null;
  if (useGeo) {
    showToast('Getting classroom location…', 'info');
    try { coords = await getGeolocation(); }
    catch(e) {
      showToast('Could not get location. Geolocation disabled.', 'error');
      DOM.settingGeo.checked = false;
      DOM.geoRadiusField.classList.add('hidden');
    }
  }

  const settings = {
    qr: true, device: DOM.settingDevice.checked,
    spotCheck: DOM.settingSpotCheck.checked,
    geo: useGeo && !!coords, ble: useBLE,
    selfie: DOM.settingSelfie.checked, geoRadius: geoR,
  };

  const now       = Date.now();
  const sessionId = generateId(12);
  const pin       = generatePIN();

  STATE.session = {
    id: sessionId, course, pin,
    startedAt: now, endsAt: now + duration * 60000, duration,
    date: todayKey(),
    lat: coords?.latitude ?? null, lng: coords?.longitude ?? null,
    settings, qrToken: null, qrExpiry: null, spotChecked: [],
  };

  STATE.attendance = [];
  renderAttendanceTable();
  updateStats();

  // UI flip
  DOM.startSessionArea.style.display  = 'none';
  DOM.activeSessionArea.style.display = '';
  DOM.activeCourseName.textContent    = course;
  DOM.activeSessionDate.textContent   = new Date().toLocaleDateString('en-NG', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  DOM.activeStartTime.textContent     = formatTime(new Date(now));
  DOM.activePIN.textContent           = pin;
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
  DOM.statSession.textContent         = course;

  DOM.geoStatusDisplay.innerHTML = settings.geo
    ? `<span class="dot green-dot"></span> Active (${geoR}m)`
    : `<span class="dot" style="background:var(--text-muted)"></span> Disabled`;

  const checks = ['QR'];
  if (settings.device)    checks.push('Device');
  if (settings.spotCheck) checks.push('Spot Checks');
  if (settings.geo)       checks.push('Geo');
  if (settings.ble)       checks.push('BLE');
  if (settings.selfie)    checks.push('Selfie');
  DOM.activeChecksDisplay.innerHTML = `<div class="checks-list">${checks.map(c=>`<span class="check-chip">${c}</span>`).join('')}</div>`;
  DOM.spotCheckPanel.classList.toggle('hidden', !settings.spotCheck);

  // Show BLE button if BLE enabled
  if (settings.ble) {
    DOM.bleBeaconBtn.style.display = '';
    DOM.bleBeaconBtn.onclick       = toggleBLEBeacon;
  }

  // Write session to Sheets
  pushToSheets('writeSession', {
    sessionId: sessionId, date: todayKey(), course, lecturer: STATE.user.name,
    startedAt: new Date(now).toISOString(), endsAt: new Date(STATE.session.endsAt).toISOString(),
    status: 'active', settings: JSON.stringify(settings),
  });

  // QR rotation
  generateNewQR();
  let cd = QR_REFRESH_SECS;
  DOM.countdownNum.textContent = cd;
  STATE.qrInterval = setInterval(() => {
    cd--; DOM.countdownNum.textContent = cd;
    if (cd <= 0) {
      cd = QR_REFRESH_SECS;
      generateNewQR();
      DOM.qrWrapper.classList.add('flash');
      setTimeout(() => DOM.qrWrapper.classList.remove('flash'), 350);
    }
  }, 1000);

  // Session countdown
  updateSessionTimer();
  STATE.sessionTimer = setInterval(() => {
    updateSessionTimer();
    if (Date.now() >= STATE.session.endsAt) {
      endSession(false);
      showToast('Session time expired', 'info');
    }
  }, 1000);

  // Poll Sheets for new check-ins from students on other devices
  startSheetsAttendancePoll();

  saveStateSnapshot();
  showToast(`Session started! QR syncing to Sheets every ${QR_REFRESH_SECS}s.`, 'success');
}

// QR generation + Sheets push
async function generateNewQR() {
  if (!STATE.session) return;
  const token  = generateId(20);
  const expiry = Date.now() + QR_REFRESH_SECS * 1000 + 3000; // 3s grace
  STATE.session.qrToken  = token;
  STATE.session.qrExpiry = expiry;

  const s = STATE.session;
  const payload = JSON.stringify({
    sid: s.id, tok: token, exp: expiry,
    crs: s.course, pin: s.pin, date: s.date,
    lat: s.lat, lng: s.lng,
    geo: s.settings.geo, rad: s.settings.geoRadius,
    dev: s.settings.device, slf: s.settings.selfie,
    ble: s.settings.ble, v: APP_VERSION,
  });

  DOM.qrSessionCode.textContent = s.id.slice(0, 8).toUpperCase();
  try {
    new QRious({ element: DOM.qrCanvas, value: payload, size: 220, level: 'H', background: '#ffffff', foreground: '#0d1630', padding: 12 });
  } catch(e) {}

  // Push token to Sheets so students on other devices can poll it
  pushToSheets('pushQRToken', {
    sessionId: s.id, token, expiry: expiry,
    course: s.course, lat: s.lat ?? '', lng: s.lng ?? '',
    geo: s.settings.geo, geoRadius: s.settings.geoRadius,
    device: s.settings.device, selfie: s.settings.selfie,
    ble: s.settings.ble, pin: s.pin, date: s.date,
  });

  saveStateSnapshot();
}

function updateSessionTimer() {
  if (!STATE.session) return;
  const rem = STATE.session.endsAt - Date.now();
  if (rem <= 0) { DOM.activeTimeLeft.textContent = 'Ended'; return; }
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  DOM.activeTimeLeft.textContent = `${m}m ${s.toString().padStart(2, '0')}s`;
}

async function endSession(silent) {
  clearInterval(STATE.qrInterval);
  clearInterval(STATE.sessionTimer);
  STATE.qrInterval = STATE.sessionTimer = null;

  if (STATE.session) {
    await pushToSheets('updateSessionStatus', { sessionId: STATE.session.id, status: 'ended' });
  }
  bleStopBeacon();
  DOM.bleBeaconBtn.style.display = 'none';
  STATE.bleBeaconActive = false;
  STATE.session = null;

  DOM.startSessionArea.style.display  = '';
  DOM.activeSessionArea.style.display = 'none';
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot inactive"></span> Inactive';
  DOM.statSession.textContent         = '—';
  DOM.activeTimeLeft.textContent      = '—';
  DOM.spotCheckPanel.classList.add('hidden');

  if (!silent) showToast('Session ended and archived in Sheets', 'info');
  saveStateSnapshot();
}

// ═══════════════════════════════════════════════════════
//  SHEETS ATTENDANCE POLLING (LECTURER SIDE)
//  — picks up check-ins submitted from student devices
// ═══════════════════════════════════════════════════════
let sheetsPollLecturerInterval = null;

function startSheetsAttendancePoll() {
  if (!sheetsGetUrl()) return;
  clearInterval(sheetsPollLecturerInterval);
  sheetsPollLecturerInterval = setInterval(async () => {
    if (!STATE.session || !STATE.isOnline) return;
    try {
      const result = await sheetsReadAttendance(STATE.session.id);
      if (!result || !Array.isArray(result.rows)) return;
      let newCount = 0;
      result.rows.forEach(row => {
        const record = {
          name:      row.studentName, matric: row.matric,
          course:    row.course, timestamp: new Date(row.checkInTime + ' ' + row.date).getTime() || Date.now(),
          date:      row.date, distance: row.distance || null,
          deviceId:  row.deviceId, sessionId: STATE.session.id,
          flagged: false, spotChecked: false, spotResult: null,
          bleVerified: row.bleVerified || false,
          source: 'sheets',
        };
        const added = addAttendanceRecord(record, true); // silent
        if (added) newCount++;
      });
      if (newCount > 0) {
        showToast(`${newCount} new check-in${newCount > 1 ? 's' : ''} from Sheets`, 'success');
      }
    } catch(e) {}
  }, 5000); // every 5s
}

// ═══════════════════════════════════════════════════════
//  SHEETS QR POLLING (STUDENT SIDE)
// ═══════════════════════════════════════════════════════
function startSheetsPoll() {
  DOM.sheetsPollingBar?.classList.remove('hidden');
  sheetsStartPolling((tokenData) => {
    STATE.liveSheetToken = tokenData;
    // Visual feedback on the scan card subtitle
    if (DOM.scanSubtitle) DOM.scanSubtitle.textContent = 'Live session found via Sheets — scan or tap below';
  });
}

// ═══════════════════════════════════════════════════════
//  BLE BEACON (LECTURER)
// ═══════════════════════════════════════════════════════
async function toggleBLEBeacon() {
  if (STATE.bleBeaconActive) {
    bleStopBeacon();
    STATE.bleBeaconActive = false;
    DOM.bleBeaconBtn.classList.remove('active');
    DOM.bleBeaconText.textContent = 'Activate BLE Beacon';
    showToast('BLE beacon stopped', 'info');
    return;
  }

  if (!bleIsSupported()) {
    showToast('Bluetooth not supported on this device. Students will use QR only.', 'error');
    return;
  }

  showToast('Opening Bluetooth… select your device to activate beacon', 'info');
  const result = await bleStartBeacon(STATE.session.id);

  if (result.success) {
    STATE.bleBeaconActive = true;
    DOM.bleBeaconBtn.classList.add('active');
    DOM.bleBeaconText.textContent = `Beacon Active — ${result.deviceName}`;
    showToast('BLE beacon active. Students with BLE enabled will verify proximity.', 'success');
    // Write beacon active flag to Sheets
    pushToSheets('updateBLEBeacon', { sessionId: STATE.session.id, bleActive: true });
  } else if (result.reason === 'cancelled') {
    showToast('Bluetooth picker cancelled. Beacon not started.', 'info');
  } else if (result.reason === 'unsupported') {
    showToast('Bluetooth not available on this device.', 'error');
  } else {
    showToast(`Bluetooth error: ${result.reason}`, 'error');
  }
}

// ═══════════════════════════════════════════════════════
//  SPOT CHECKS
// ═══════════════════════════════════════════════════════
DOM.triggerSpotCheckBtn.addEventListener('click', triggerSpotCheck);

function triggerSpotCheck() {
  if (!STATE.attendance.length) { showToast('No attendees to check yet', 'error'); return; }
  const eligible = STATE.attendance.filter(r => !r.spotChecked);
  const count    = Math.max(1, Math.ceil(eligible.length * SPOT_CHECK_PCT));
  const selected = shuffleArray([...eligible]).slice(0, count);
  if (!selected.length) { showToast('All students checked', 'info'); return; }

  DOM.spotCheckList.innerHTML = selected.map(r => `
    <div class="spot-check-item" id="sc_${r.matric}">
      <div class="spot-check-student">
        <strong>${escHtml(r.name)}</strong>
        <span>${escHtml(r.matric || '—')}</span>
      </div>
      <div class="spot-check-actions">
        <button class="btn-spot-present" onclick="resolveSpotCheck('${r.matric}',true)">✓ Present</button>
        <button class="btn-spot-absent"  onclick="resolveSpotCheck('${r.matric}',false)">✗ Absent</button>
      </div>
    </div>`).join('');

  broadcastSpotCheck(selected.map(r => r.matric));
  showToast(`Spot checking ${selected.length} student${selected.length > 1 ? 's' : ''}`, 'info');
}

window.resolveSpotCheck = function(matric, present) {
  const rec = STATE.attendance.find(r => r.matric === matric);
  if (rec) { rec.spotChecked = true; rec.spotResult = present ? 'confirmed' : 'absent'; if (!present) rec.flagged = true; }
  const el = $(`sc_${matric}`);
  if (el) el.querySelector('.spot-check-actions').innerHTML =
    `<span class="spot-result-chip ${present ? 'confirmed' : 'absent'}">${present ? '✓ Confirmed' : '✗ Absent'}</span>`;
  renderAttendanceTable(); updateStats(); saveStateSnapshot();
  if (STATE.session) pushToSheets('updateSpotCheck', { sessionId: STATE.session.id, matric, result: present ? 'confirmed' : 'absent' });
};

// ═══════════════════════════════════════════════════════
//  ATTENDANCE LOG
// ═══════════════════════════════════════════════════════
function addAttendanceRecord(record, silent = false) {
  // Deduplicate by matric within same session
  const dup = STATE.attendance.find(r => r.matric === record.matric && r.sessionId === record.sessionId);
  if (dup) return false;
  STATE.attendance.push(record);
  renderAttendanceTable();
  updateStats();
  saveStateSnapshot();
  return true;
}

function renderAttendanceTable() {
  if (!STATE.attendance.length) {
    DOM.attendanceBody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p>No students checked in yet</p>
        </div>
      </td></tr>`;
    return;
  }
  DOM.attendanceBody.innerHTML = STATE.attendance.map((r, i) => {
    const status = r.spotResult === 'absent' ? `<span class="status-chip suspicious">✗ Absent</span>`
      : r.flagged ? `<span class="status-chip suspicious">⚠ Flagged</span>`
      : r.spotResult === 'confirmed' ? `<span class="status-chip present">✓ Verified</span>`
      : `<span class="status-chip present">✓ Present</span>`;
    const dateStr = r.date || (r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'}) : '—');
    const timeStr = r.timestamp ? formatTime(new Date(r.timestamp)) : '—';
    const ble     = r.bleVerified ? '<span style="color:var(--success)">✓</span>' : '—';
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.name)}</td>
      <td>${escHtml(r.matric || '—')}</td>
      <td><span class="date-badge">${dateStr}</span></td>
      <td>${timeStr}</td>
      <td>${r.distance != null ? r.distance + 'm' : '—'}</td>
      <td><span class="device-tag">${r.deviceId || '—'}</span></td>
      <td>${ble}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function updateStats() {
  const total   = STATE.attendance.length;
  const flagged = STATE.attendance.filter(r => r.flagged || r.spotResult === 'absent').length;
  DOM.statTotal.textContent   = total;
  DOM.statRate.textContent    = total > 0 ? total + ' in' : '0%';
  DOM.statFlagged.textContent = flagged;
}

DOM.clearAttendanceBtn.addEventListener('click', () => {
  confirmModal('Clear Log?', 'Removes records from this view. Sheets data is not deleted.', () => {
    STATE.attendance = []; renderAttendanceTable(); updateStats(); saveStateSnapshot();
  });
});

// ═══════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════
DOM.exportBtn.addEventListener('click', exportExcel);
function exportExcel() {
  if (!STATE.attendance.length) { showToast('No records to export', 'error'); return; }
  const course  = STATE.session?.course || STATE.attendance[0]?.course || 'Course';
  const dateStr = new Date().toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`SCHOOLER Attendance — ${course} — ${dateStr}`], [],
    ['#','Name','Matric','Date','Check-in Time','Distance','Device ID','BLE','Status','Spot Check'],
    ...STATE.attendance.map((r,i) => [
      i+1, r.name, r.matric||'N/A',
      r.date || new Date(r.timestamp).toLocaleDateString('en-NG'),
      r.timestamp ? formatTime(new Date(r.timestamp)) : '—',
      r.distance != null ? `${r.distance}m` : 'N/A',
      r.deviceId||'N/A',
      r.bleVerified ? 'Yes' : 'No',
      r.spotResult==='absent'?'Absent (Spot Check)':r.flagged?'Flagged':'Present',
      r.spotResult?(r.spotResult==='confirmed'?'Verified':'Absent'):'Not checked',
    ]),
    [], ['Summary'],
    ['Total Present', STATE.attendance.length],
    ['Flagged', STATE.attendance.filter(r=>r.flagged).length],
    ['BLE Verified', STATE.attendance.filter(r=>r.bleVerified).length],
    ['Session', course], ['Export Date', new Date().toLocaleString('en-NG')],
    ['Generated by', 'SCHOOLER v'+APP_VERSION],
  ]);
  ws['!cols'] = [{wch:4},{wch:24},{wch:18},{wch:14},{wch:14},{wch:10},{wch:14},{wch:6},{wch:18},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `SCHOOLER_${course.replace(/\s/g,'_')}_${Date.now()}.xlsx`);
  showToast('Excel downloaded!', 'success');
}

// ═══════════════════════════════════════════════════════
//  QR SCANNER (STUDENT)
// ═══════════════════════════════════════════════════════
DOM.startScanBtn.addEventListener('click', startScanner);
DOM.scanAgainBtn.addEventListener('click', resetStudentScan);
DOM.manualSubmitBtn.addEventListener('click', handleManualCode);

async function startScanner() {
  if (STATE.scanActive) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
    });
    STATE.scanStream  = stream;
    STATE.scanActive  = true;
    DOM.scannerVideo.srcObject = stream;
    DOM.scannerVideo.play();
    DOM.startScanBtn.style.display = 'none';
    DOM.scanHint.textContent = 'Point at QR code…';
    requestAnimationFrame(scanFrame);
  } catch(e) {
    showToast('Camera access denied. Use manual code below.', 'error');
  }
}

function scanFrame() {
  if (!STATE.scanActive) return;
  const video = DOM.scannerVideo;
  if (video.readyState !== video.HAVE_ENOUGH_DATA) { STATE.scanAnimFrame = requestAnimationFrame(scanFrame); return; }
  const canvas = DOM.scannerCanvas, ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (code) { stopScanner(); handleQRData(code.data); return; }
  STATE.scanAnimFrame = requestAnimationFrame(scanFrame);
}

function stopScanner() {
  STATE.scanActive = false;
  if (STATE.scanAnimFrame) cancelAnimationFrame(STATE.scanAnimFrame);
  if (STATE.scanStream) { STATE.scanStream.getTracks().forEach(t => t.stop()); STATE.scanStream = null; }
  DOM.scannerVideo.srcObject = null;
  DOM.startScanBtn.style.display = '';
  DOM.scanHint.textContent = 'Tap to start camera';
}

async function handleQRData(raw) {
  let payload;
  try { payload = JSON.parse(raw); } catch(e) { showStudentError('Invalid QR Code', 'This QR code is not from SCHOOLER.'); return; }
  if (!payload.sid || !payload.tok || !payload.exp) { showStudentError('Invalid QR Code', 'QR data is malformed.'); return; }

  // Expiry check
  if (Date.now() > payload.exp) {
    showStudentError('QR Code Expired', 'This QR has expired — they refresh every 10 seconds. Wait for the next one.'); return;
  }

  // Date check — session must be from today
  if (payload.date && payload.date !== todayKey()) {
    showStudentError('Wrong Day', `This QR is from ${payload.date}. Today's sessions only.`); return;
  }

  // Device-seen-today check (per session per day)
  if (payload.dev) {
    if (hasSeenTodayForSession(STATE.user.matric, payload.sid)) {
      // Don't block — just inform. New day = new session = fresh start.
      showStudentInfo(
        'Already Recorded',
        'This device has already submitted attendance for this session. If you are using a shared device, please note: each student should use their own device. Your first scan has been recorded.',
        payload
      );
      return;
    }
  }

  // BLE proximity check
  let bleVerified = false;
  if (payload.ble) {
    showToast('Checking Bluetooth proximity…', 'info');
    const bleResult = await bleScanForBeacon(payload.sid);
    if (!bleResult.verified && !bleResult.fallback) {
      showStudentError('BLE Check Failed', bleResult.reason); return;
    }
    bleVerified = bleResult.verified;
    if (!bleResult.verified && bleResult.fallback) {
      showToast('Bluetooth scan failed — continuing with QR only', 'info');
    }
  }

  // Geo check
  let distRounded = null;
  if (payload.geo && payload.lat && payload.lng) {
    showToast('Verifying location…', 'info');
    let coords;
    try { coords = await getGeolocation(); }
    catch(e) { showStudentError('Location Required', 'Enable location services to mark attendance.'); return; }
    if (coords.accuracy > 150) { showStudentError('Weak GPS', `GPS accuracy is ${Math.round(coords.accuracy)}m. Move closer to a window.`); return; }
    const dist = haversineDistance(coords.latitude, coords.longitude, payload.lat, payload.lng);
    distRounded = Math.round(dist);
    if (dist > (payload.rad || 50)) { showStudentError('Too Far Away', `You are ${distRounded}m away. Must be within ${payload.rad||50}m.`); return; }
  }

  // Build record
  const record = {
    name: STATE.user.name, matric: STATE.user.matric || '',
    course: payload.crs, timestamp: Date.now(),
    date: todayKey(), distance: distRounded,
    sessionId: payload.sid, deviceId: getDeviceShort(),
    flagged: false, spotChecked: false, spotResult: null,
    bleVerified,
  };

  // Selfie flow
  if (payload.slf) {
    try {
      await captureSelfie();
    } catch(e) {
      // Selfie failed or cancelled — lecturer overrides, attendance still submitted
      showToast('Selfie skipped — attendance submitted without photo', 'info');
    }
  }

  // Mark device seen today for this session
  if (payload.dev) markSeenTodayForSession(STATE.user.matric, payload.sid);

  // Submit
  if (!STATE.isOnline) {
    queueOfflineRecord(record);
    record.offlineQueued = true;
  } else {
    try {
      await sheetsAppendAttendance(record);
    } catch(e) {
      queueOfflineRecord(record);
      record.offlineQueued = true;
    }
    broadcastAttendance(record);
    relayAttendance(record);
  }

  STATE.studentHistory.unshift({ course: payload.crs, date: todayKey(), timestamp: record.timestamp, status: STATE.isOnline ? 'present' : 'offline', bleVerified });
  renderStudentHistory();
  saveStateSnapshot();
  showStudentSuccess(record, distRounded, bleVerified);
}

function handleManualCode() {
  const raw = DOM.manualCode.value.trim();
  if (!raw) { showToast('Enter a session code or PIN', 'error'); return; }

  // Try live Sheets token first
  if (STATE.liveSheetToken) {
    const t = STATE.liveSheetToken;
    if (raw.toUpperCase() === t.sessionId?.slice(0,8).toUpperCase() ||
        raw.toUpperCase() === (t.pin||'').toUpperCase()) {
      const fakePayload = JSON.stringify({
        sid: t.sessionId, tok: t.token, exp: t.expiry,
        crs: t.course, pin: t.pin, date: t.date || todayKey(),
        lat: t.lat, lng: t.lng,
        geo: t.geo, rad: t.geoRadius,
        dev: t.device, slf: t.selfie, ble: t.ble, v: APP_VERSION,
      });
      handleQRData(fakePayload); return;
    }
  }

  // Try localStorage relay (same device)
  const relay = localStorage.getItem('schooler_session');
  if (relay) {
    try {
      const session = JSON.parse(relay);
      if (session.id.slice(0,8).toUpperCase() === raw.toUpperCase() || session.pin === raw.toUpperCase()) {
        const fakePayload = JSON.stringify({
          sid: session.id, tok: session.qrToken, exp: session.qrExpiry,
          crs: session.course, pin: session.pin, date: session.date || todayKey(),
          lat: session.lat, lng: session.lng,
          geo: session.settings?.geo??false, rad: session.settings?.geoRadius??50,
          dev: session.settings?.device??true, slf: session.settings?.selfie??false,
          ble: session.settings?.ble??false, v: APP_VERSION,
        });
        handleQRData(fakePayload); return;
      }
    } catch(e) {}
  }

  showToast('Code not found. Make sure you have the correct session code from your lecturer.', 'error');
}

// ─── Selfie capture ──────────────────────────────
function captureSelfie() {
  return new Promise(async (resolve, reject) => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch(e) { reject(e); return; }

    STATE.selfieStream     = stream;
    DOM.selfieVideo.srcObject = stream;
    DOM.selfieVideo.play();
    DOM.selfieModal.classList.remove('hidden');

    DOM.selfieCaptureBtn.onclick = () => {
      const canvas = DOM.selfieCanvas;
      canvas.width  = DOM.selfieVideo.videoWidth;
      canvas.height = DOM.selfieVideo.videoHeight;
      canvas.getContext('2d').drawImage(DOM.selfieVideo, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      STATE.selfieStream = null;
      DOM.selfieModal.classList.add('hidden');
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    DOM.selfieCancelBtn.onclick = () => {
      stream.getTracks().forEach(t => t.stop());
      STATE.selfieStream = null;
      DOM.selfieModal.classList.add('hidden');
      reject(new Error('cancelled'));
    };
  });
}

// ─── Student display ─────────────────────────────
function showStudentSuccess(record, dist, bleVerified) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className    = 'status-icon success';
  DOM.statusIcon.innerHTML    = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  DOM.statusTitle.textContent = record.offlineQueued ? 'Saved Locally!' : 'Attendance Marked!';
  DOM.statusMsg.textContent   = record.offlineQueued
    ? 'Your attendance has been saved locally and will sync once internet access is restored.'
    : 'You have been successfully recorded in Google Sheets for this session.';
  DOM.statusMeta.innerHTML = `
    <span>📚 ${escHtml(record.course)}</span>
    <span>📅 ${record.date || todayKey()}</span>
    <span>⏱ ${formatTime(new Date(record.timestamp))}</span>
    ${dist != null ? `<span>📍 ${dist}m from classroom</span>` : ''}
    <span>👤 ${escHtml(record.name)} · ${escHtml(record.matric)}</span>
    <span>📱 Device: ${record.deviceId}</span>
    ${bleVerified ? '<span>📶 BLE proximity verified</span>' : ''}`;
  showToast(record.offlineQueued ? 'Saved offline' : 'Attendance recorded in Sheets!', 'success');
}

function showStudentError(title, msg) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className    = 'status-icon error';
  DOM.statusIcon.innerHTML    = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  DOM.statusTitle.textContent = title;
  DOM.statusMsg.textContent   = msg;
  DOM.statusMeta.innerHTML    = '';
  showToast(title, 'error');
}

function showStudentInfo(title, msg, payload) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className    = 'status-icon';
  DOM.statusIcon.style.background = 'rgba(26,108,255,0.12)';
  DOM.statusIcon.style.color      = 'var(--accent-blue-bright)';
  DOM.statusIcon.innerHTML    = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  DOM.statusTitle.textContent = title;
  DOM.statusMsg.textContent   = msg;
  DOM.statusMeta.innerHTML    = `<span>📚 ${escHtml(payload?.crs||'')}</span><span>📅 ${todayKey()}</span>`;
}

function renderStudentHistory() {
  if (!STATE.studentHistory.length) return;
  const present = STATE.studentHistory.filter(h => h.status !== 'absent').length;
  DOM.historyRate.textContent = `${Math.round((present/STATE.studentHistory.length)*100)}% attendance`;
  DOM.historyList.innerHTML   = STATE.studentHistory.map(h => `
    <div class="history-item">
      <div>
        <div class="history-course">${escHtml(h.course)}</div>
        <div class="history-time">${h.date || ''} ${h.timestamp ? formatTime(new Date(h.timestamp)) : ''} ${h.bleVerified?'· 📶 BLE':''}</div>
      </div>
      <span class="history-status ${h.status}">${h.status==='offline'?'⏳ Pending':'✓ Present'}</span>
    </div>`).join('');
}

function resetStudentScan() {
  DOM.statusCard.classList.add('hidden');
  DOM.scanCard.classList.remove('hidden');
  DOM.statusIcon.style.background = '';
  DOM.statusIcon.style.color      = '';
  DOM.manualCode.value = '';
}

// ═══════════════════════════════════════════════════════
//  BROADCAST / RELAY (same-device / same-LAN)
// ═══════════════════════════════════════════════════════
let bc;
try { bc = new BroadcastChannel('schooler_attendance'); } catch(e) { bc = null; }

function broadcastAttendance(record) { if (bc) bc.postMessage({ type: 'attendance', record }); }
function broadcastSpotCheck(matricList) { if (bc) bc.postMessage({ type: 'spot_check', matricList }); }

if (bc) {
  bc.onmessage = ev => {
    if (ev.data?.type === 'attendance' && STATE.role === 'lecturer' && STATE.session) {
      if (ev.data.record.sessionId === STATE.session.id) {
        const added = addAttendanceRecord(ev.data.record);
        if (added) showToast(`${ev.data.record.name} checked in`, 'success');
      }
    }
    if (ev.data?.type === 'spot_check' && STATE.role === 'student' && STATE.user) {
      if (ev.data.matricList.includes(STATE.user.matric)) {
        DOM.spotCheckNotification.classList.remove('hidden');
        setTimeout(() => DOM.spotCheckNotification.classList.add('hidden'), 15000);
      }
    }
  };
}

function relayAttendance(record) {
  localStorage.setItem('schooler_checkin', JSON.stringify({ record, ts: Date.now() }));
}

// LocalStorage poll fallback (same device, different tab)
setInterval(() => {
  if (STATE.role !== 'lecturer' || !STATE.session) return;
  const raw = localStorage.getItem('schooler_checkin');
  if (!raw) return;
  try {
    const { record, ts } = JSON.parse(raw);
    if (Date.now() - ts > 20000) return;
    if (record.sessionId === STATE.session.id) {
      const added = addAttendanceRecord(record);
      if (added) { showToast(`${record.name} checked in`, 'success'); localStorage.removeItem('schooler_checkin'); }
    }
  } catch(e) {}
}, 1500);

// ═══════════════════════════════════════════════════════
//  GEOLOCATION
// ═══════════════════════════════════════════════════════
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Not supported')); return; }
    navigator.geolocation.getCurrentPosition(pos => resolve(pos.coords), reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}
function haversineDistance(lat1,lon1,lat2,lon2) {
  const R=6371000, dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const toRad = d => d*Math.PI/180;

// ═══════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════
function saveStateSnapshot() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      role: STATE.role, user: STATE.user,
      session: STATE.session, attendance: STATE.attendance,
      studentHistory: STATE.studentHistory, offlineQueue: STATE.offlineQueue,
    }));
    if (STATE.session) localStorage.setItem('schooler_session', JSON.stringify(STATE.session));
    else               localStorage.removeItem('schooler_session');
  } catch(e) {}
}
function loadSavedState() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('schooler_session');
  localStorage.removeItem('schooler_checkin');
}

function restoreSession(saved) {
  STATE.role           = saved.role;
  STATE.user           = saved.user;
  STATE.attendance     = saved.attendance     || [];
  STATE.studentHistory = saved.studentHistory || [];
  STATE.offlineQueue   = saved.offlineQueue   || [];
  updateSheetsIndicator();

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = STATE.user?.course || '';
    renderAttendanceTable(); updateStats();
    showScreen('lecturer');

    if (saved.session && saved.session.endsAt > Date.now() && saved.session.date === todayKey()) {
      // Restore active session (same day)
      STATE.session = saved.session;
      DOM.startSessionArea.style.display  = 'none';
      DOM.activeSessionArea.style.display = '';
      DOM.activeCourseName.textContent    = STATE.session.course;
      DOM.activeSessionDate.textContent   = new Date().toLocaleDateString('en-NG',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      DOM.activeStartTime.textContent     = formatTime(new Date(STATE.session.startedAt));
      DOM.activePIN.textContent           = STATE.session.pin;
      DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
      DOM.statSession.textContent         = STATE.session.course;

      const s = STATE.session.settings || {};
      DOM.geoStatusDisplay.innerHTML = s.geo
        ? `<span class="dot green-dot"></span> Active (${s.geoRadius}m)`
        : `<span class="dot" style="background:var(--text-muted)"></span> Disabled`;
      const checks = ['QR'];
      if (s.device)    checks.push('Device');
      if (s.spotCheck) checks.push('Spot Checks');
      if (s.geo)       checks.push('Geo');
      if (s.ble)       checks.push('BLE');
      if (s.selfie)    checks.push('Selfie');
      DOM.activeChecksDisplay.innerHTML = `<div class="checks-list">${checks.map(c=>`<span class="check-chip">${c}</span>`).join('')}</div>`;
      DOM.spotCheckPanel.classList.toggle('hidden', !s.spotCheck);

      if (s.ble) { DOM.bleBeaconBtn.style.display = ''; DOM.bleBeaconBtn.onclick = toggleBLEBeacon; }

      generateNewQR();
      let cd = QR_REFRESH_SECS;
      DOM.countdownNum.textContent = cd;
      STATE.qrInterval = setInterval(() => {
        cd--; DOM.countdownNum.textContent = cd;
        if (cd <= 0) { cd = QR_REFRESH_SECS; generateNewQR(); DOM.qrWrapper.classList.add('flash'); setTimeout(()=>DOM.qrWrapper.classList.remove('flash'),350); }
      }, 1000);
      updateSessionTimer();
      STATE.sessionTimer = setInterval(() => {
        updateSessionTimer();
        if (Date.now() >= STATE.session.endsAt) { endSession(false); showToast('Session expired','info'); }
      }, 1000);
      startSheetsAttendancePoll();
      showToast(`Session restored — ${STATE.session.course}`, 'info');
    } else if (saved.session && saved.session.date !== todayKey()) {
      // Old session from a previous day — archive and start fresh
      showToast('Previous session archived. Start a new session for today.', 'info');
    }
  } else if (STATE.role === 'student') {
    DOM.studentName.textContent          = STATE.user.name;
    DOM.studentMatricDisplay.textContent = STATE.user.matric ? `${STATE.user.matric} · ${STATE.user.course}` : STATE.user.course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    renderStudentHistory();
    if (sheetsGetUrl()) startSheetsPoll();
    showScreen('student');
    updateOfflineUI();
    syncOfflineQueue();
    showToast(`Welcome back, ${STATE.user.name}`, 'info');
  } else {
    showScreen('auth');
  }
}

// ═══════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type='info') {
  clearTimeout(toastTimer);
  DOM.toast.textContent = msg;
  DOM.toast.className   = `toast ${type}`;
  DOM.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), 3800);
}
function confirmModal(title, msg, onConfirm) {
  DOM.modalTitle.textContent = title;
  DOM.modalMsg.textContent   = msg;
  DOM.modal.classList.remove('hidden');
  const cleanup = () => DOM.modal.classList.add('hidden');
  DOM.modalConfirm.onclick = () => { cleanup(); onConfirm(); };
  DOM.modalCancel.onclick  = cleanup;
}
function formatTime(date) {
  return date.toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function generateId(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b%chars.length]).join('');
}
function generatePIN() {
  const n = new Uint8Array(3), l = new Uint8Array(3);
  crypto.getRandomValues(n); crypto.getRandomValues(l);
  return Array.from(n,b=>b%10).join('') + '-' + Array.from(l,b=>String.fromCharCode(65+b%26)).join('');
}
function shuffleArray(arr) {
  for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

// ═══════════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[SCHOOLER] SW registered'))
      .catch(e => console.warn('[SCHOOLER] SW failed:', e));
  });
}
