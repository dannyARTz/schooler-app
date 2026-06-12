/* ══════════════════════════════════════════════════
   SCHOOLER — Main App Logic  v1.1.0
   Handles: Auth, Device Binding, Sessions, Settings,
            QR Gen/Scan, Geo-fence (optional),
            Spot Checks, Offline Queue, Export
══════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
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
  theme: 'dark',
  isOnline: navigator.onLine,
  deviceId: null,
};

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const QR_REFRESH_SECS   = 10;
const APP_VERSION       = '1.1.0';
const STORAGE_KEY       = 'schooler_state';
const SPOT_CHECK_PCT    = 0.05; // 5%

// ═══════════════════════════════════════════════════
//  DOM REFS
// ═══════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const DOM = {
  splash:              $('splash'),
  authScreen:          $('authScreen'),
  lecturerDash:        $('lecturerDashboard'),
  studentDash:         $('studentDashboard'),
  // Auth
  authName:            $('authName'),
  authMatric:          $('authMatric'),
  authCourse:          $('authCourse'),
  authDept:            $('authDept'),
  authBtn:             $('authBtn'),
  matricGroup:         $('matricGroup'),
  courseGroup:         $('courseGroup'),
  deptGroup:           $('deptGroup'),
  deviceWarning:       $('deviceWarning'),
  roleTabs:            document.querySelectorAll('.role-tab'),
  // Stats
  statTotal:           $('statTotal'),
  statRate:            $('statRate'),
  statFlagged:         $('statFlagged'),
  statSession:         $('statSession'),
  // Settings toggles
  settingQR:           $('settingQR'),
  settingDevice:       $('settingDevice'),
  settingSpotCheck:    $('settingSpotCheck'),
  settingGeo:          $('settingGeo'),
  settingBLE:          $('settingBLE'),
  settingSelfie:       $('settingSelfie'),
  geoRadiusField:      $('geoRadiusField'),
  geoRadius:           $('geoRadius'),
  // Session
  sessionCourse:       $('sessionCourse'),
  sessionDuration:     $('sessionDuration'),
  startSessionBtn:     $('startSessionBtn'),
  endSessionBtn:       $('endSessionBtn'),
  startSessionArea:    $('startSessionArea'),
  activeSessionArea:   $('activeSessionArea'),
  sessionStatusBadge:  $('sessionStatusBadge'),
  // QR
  qrCanvas:            $('qrCanvas'),
  countdownNum:        $('countdownNum'),
  qrSessionCode:       $('qrSessionCode'),
  qrWrapper:           document.querySelector('.qr-wrapper'),
  // Active info
  activeCourseName:    $('activeCourseName'),
  activeStartTime:     $('activeStartTime'),
  activeTimeLeft:      $('activeTimeLeft'),
  geoStatusDisplay:    $('geoStatusDisplay'),
  activeChecksDisplay: $('activeChecksDisplay'),
  activePIN:           $('activePIN'),
  // Spot check
  spotCheckPanel:      $('spotCheckPanel'),
  spotCheckList:       $('spotCheckList'),
  triggerSpotCheckBtn: $('triggerSpotCheckBtn'),
  // Table
  attendanceBody:      $('attendanceBody'),
  exportBtn:           $('exportBtn'),
  clearAttendanceBtn:  $('clearAttendanceBtn'),
  // Student
  studentName:         $('studentName'),
  studentMatricDisplay:$('studentMatricDisplay'),
  deviceChip:          $('deviceChip'),
  offlineQueueBanner:  $('offlineQueueBanner'),
  spotCheckNotification:$('spotCheckNotification'),
  scannerVideo:        $('scannerVideo'),
  scannerCanvas:       $('scannerCanvas'),
  startScanBtn:        $('startScanBtn'),
  scanHint:            $('scanHint'),
  scanCard:            $('scanCard'),
  statusCard:          $('statusCard'),
  statusIcon:          $('statusIcon'),
  statusTitle:         $('statusTitle'),
  statusMsg:           $('statusMsg'),
  statusMeta:          $('statusMeta'),
  scanAgainBtn:        $('scanAgainBtn'),
  manualCode:          $('manualCode'),
  manualSubmitBtn:     $('manualSubmitBtn'),
  historyList:         $('historyList'),
  historyRate:         $('historyRate'),
  // Offline
  offlineBadge:        $('offlineBadge'),
  offlineBadgeStudent: $('offlineBadgeStudent'),
  // UI
  toast:               $('toast'),
  modal:               $('modal'),
  modalTitle:          $('modalTitle'),
  modalMsg:            $('modalMsg'),
  modalCancel:         $('modalCancel'),
  modalConfirm:        $('modalConfirm'),
  themeToggle:         $('themeToggle'),
  themeToggleStudent:  $('themeToggleStudent'),
  themeIconDark:       $('themeIconDark'),
  themeIconLight:      $('themeIconLight'),
  lecturerLogout:      $('lecturerLogout'),
  studentLogout:       $('studentLogout'),
};

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initDeviceId();
  initNetworkListeners();
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
      showScreen('auth');
    }
  }, 400);
}

// ═══════════════════════════════════════════════════
//  DEVICE FINGERPRINT / BINDING
// ═══════════════════════════════════════════════════
function initDeviceId() {
  let id = localStorage.getItem('schooler_device_id');
  if (!id) {
    id = generateId(24) + '_' + navigator.platform.replace(/\s/g,'').slice(0,6);
    localStorage.setItem('schooler_device_id', id);
  }
  STATE.deviceId = id;
}

function getDeviceShort() {
  return STATE.deviceId ? STATE.deviceId.slice(0, 8).toUpperCase() : 'UNKNOWN';
}

function checkDeviceBinding(matric) {
  // In a real app this checks a server; here we use localStorage per-matric
  const key   = `schooler_device_bind_${matric}`;
  const bound = localStorage.getItem(key);
  if (!bound) {
    // First login — bind this device
    localStorage.setItem(key, STATE.deviceId);
    return { bound: true, isNewBind: true };
  }
  if (bound === STATE.deviceId) {
    return { bound: true, isNewBind: false };
  }
  // Different device detected
  const lastChange = localStorage.getItem(`schooler_device_change_${matric}`);
  const daysSinceChange = lastChange
    ? (Date.now() - parseInt(lastChange)) / (1000*60*60*24)
    : 999;
  return { bound: false, isNewBind: false, daysSinceChange };
}

function bindDevice(matric) {
  localStorage.setItem(`schooler_device_bind_${matric}`, STATE.deviceId);
  localStorage.setItem(`schooler_device_change_${matric}`, Date.now().toString());
}

// ═══════════════════════════════════════════════════
//  OFFLINE / NETWORK
// ═══════════════════════════════════════════════════
function initNetworkListeners() {
  window.addEventListener('online',  () => { STATE.isOnline = true;  updateOfflineUI(); syncOfflineQueue(); });
  window.addEventListener('offline', () => { STATE.isOnline = false; updateOfflineUI(); });
  updateOfflineUI();
}

function updateOfflineUI() {
  const offline = !STATE.isOnline;
  if (DOM.offlineBadge)        DOM.offlineBadge.classList.toggle('hidden', !offline);
  if (DOM.offlineBadgeStudent) DOM.offlineBadgeStudent.classList.toggle('hidden', !offline);
  if (DOM.offlineQueueBanner)  DOM.offlineQueueBanner.classList.toggle('hidden', STATE.offlineQueue.length === 0 || STATE.isOnline);
}

function queueOfflineRecord(record) {
  STATE.offlineQueue.push(record);
  saveStateSnapshot();
  updateOfflineUI();
  showToast('Attendance saved locally — will sync when online', 'info');
}

function syncOfflineQueue() {
  if (!STATE.isOnline || STATE.offlineQueue.length === 0) return;
  // In production this would POST to server. Here we flush into attendance.
  STATE.offlineQueue.forEach(record => {
    record.offlineSynced = true;
    addAttendanceRecord(record);
  });
  STATE.offlineQueue = [];
  saveStateSnapshot();
  updateOfflineUI();
  if (STATE.offlineQueue.length === 0) showToast('Offline records synced', 'success');
}

// ═══════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════
function loadTheme() {
  const saved = localStorage.getItem('schooler_theme') || 'dark';
  applyTheme(saved);
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

// ═══════════════════════════════════════════════════
//  SCREEN ROUTING
// ═══════════════════════════════════════════════════
function showScreen(name) {
  DOM.authScreen.classList.add('hidden');
  DOM.lecturerDash.classList.add('hidden');
  DOM.studentDash.classList.add('hidden');
  if (name === 'auth')     DOM.authScreen.classList.remove('hidden');
  if (name === 'lecturer') DOM.lecturerDash.classList.remove('hidden');
  if (name === 'student')  DOM.studentDash.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════
//  SETTINGS PANEL BEHAVIOUR
// ═══════════════════════════════════════════════════
DOM.settingGeo.addEventListener('change', () => {
  DOM.geoRadiusField.classList.toggle('hidden', !DOM.settingGeo.checked);
});

// ═══════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════
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

DOM.authName.addEventListener('blur', checkDeviceWarning);
DOM.authMatric.addEventListener('blur', checkDeviceWarning);

function checkDeviceWarning() {
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
  if (selectedRole === 'student' && !matric) {
    showToast('Please enter your matric number', 'error'); return;
  }

  // Device binding check for students
  if (selectedRole === 'student') {
    const check = checkDeviceBinding(matric);
    if (!check.bound) {
      if (check.daysSinceChange < 30) {
        showToast(`Device switch request pending. Next change allowed in ${Math.ceil(30 - check.daysSinceChange)} days.`, 'error');
        return;
      }
      // Allow bind on new device (would require admin approval in full system)
      bindDevice(matric);
      showToast('Device registered. Administrator approval may be required.', 'info');
    }
    if (check.isNewBind) {
      showToast('Device bound to your account', 'success');
    }
  }

  STATE.role = selectedRole;
  STATE.user = { name, course, dept, matric };
  saveStateSnapshot();

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = course;
    showScreen('lecturer');
    renderAttendanceTable();
    updateStats();
    showToast(`Welcome, ${name}`, 'success');
  } else {
    DOM.studentName.textContent          = name;
    DOM.studentMatricDisplay.textContent = matric ? `${matric} · ${course}` : course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    renderStudentHistory();
    showScreen('student');
    syncOfflineQueue();
    showToast(`Welcome, ${name}`, 'success');
  }
}

// Logout
DOM.lecturerLogout.addEventListener('click', () => {
  confirmModal('Sign out?', 'This will end any active session.', () => {
    endSession(true);
    clearSavedState();
    STATE.role = null; STATE.user = null;
    showScreen('auth');
  });
});

DOM.studentLogout.addEventListener('click', () => {
  stopScanner();
  clearSavedState();
  STATE.role = null; STATE.user = null;
  showScreen('auth');
});

// ═══════════════════════════════════════════════════
//  SESSION MANAGEMENT (LECTURER)
// ═══════════════════════════════════════════════════
DOM.startSessionBtn.addEventListener('click', startSession);
DOM.endSessionBtn.addEventListener('click', () => {
  confirmModal('End Session?', 'Students will no longer be able to check in.', () => endSession(false));
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
    try {
      coords = await getGeolocation();
    } catch (e) {
      showToast('Could not get location. Geolocation disabled for this session.', 'error');
      DOM.settingGeo.checked = false;
      DOM.geoRadiusField.classList.add('hidden');
    }
  }

  if (useBLE) {
    showToast('BLE: Checking Bluetooth support…', 'info');
    if (!navigator.bluetooth) {
      showToast('Bluetooth verification is unavailable on this device. Falling back to QR verification.', 'info');
      DOM.settingBLE.checked = false;
    }
  }

  const sessionId = generateId(12);
  const pin       = generatePIN();
  const now       = Date.now();

  // Capture active settings snapshot
  const settings = {
    qr:         true, // always on
    device:     DOM.settingDevice.checked,
    spotCheck:  DOM.settingSpotCheck.checked,
    geo:        useGeo && coords !== null,
    ble:        DOM.settingBLE.checked,
    selfie:     DOM.settingSelfie.checked,
    geoRadius:  geoR,
  };

  STATE.session = {
    id: sessionId, course, pin,
    startedAt: now,
    endsAt:    now + duration * 60 * 1000,
    duration,
    lat:       coords?.latitude  ?? null,
    lng:       coords?.longitude ?? null,
    accuracy:  coords?.accuracy  ?? null,
    settings,
    qrToken:   null,
    qrExpiry:  null,
    spotChecked: [],
  };

  STATE.attendance = [];
  renderAttendanceTable();
  updateStats();

  // UI flip
  DOM.startSessionArea.style.display  = 'none';
  DOM.activeSessionArea.style.display = '';
  DOM.activeCourseName.textContent    = course;
  DOM.activeStartTime.textContent     = formatTime(new Date(now));
  DOM.activePIN.textContent           = pin;
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
  DOM.statSession.textContent         = course;

  // Geo status
  if (settings.geo) {
    DOM.geoStatusDisplay.innerHTML = `<span class="dot green-dot"></span> Active (${geoR}m radius)`;
  } else {
    DOM.geoStatusDisplay.innerHTML = `<span class="dot" style="background:var(--text-muted)"></span> Disabled`;
  }

  // Active checks summary
  const checks = ['QR'];
  if (settings.device)    checks.push('Device');
  if (settings.spotCheck) checks.push('Spot Checks');
  if (settings.geo)       checks.push('Geo');
  if (settings.ble)       checks.push('BLE');
  if (settings.selfie)    checks.push('Selfie');
  DOM.activeChecksDisplay.innerHTML = `<div class="checks-list">${checks.map(c => `<span class="check-chip">${c}</span>`).join('')}</div>`;

  // Show spot check panel if enabled
  DOM.spotCheckPanel.classList.toggle('hidden', !settings.spotCheck);

  // QR rotation
  generateNewQR();
  let countdown = QR_REFRESH_SECS;
  DOM.countdownNum.textContent = countdown;
  STATE.qrInterval = setInterval(() => {
    countdown--;
    DOM.countdownNum.textContent = countdown;
    if (countdown <= 0) {
      countdown = QR_REFRESH_SECS;
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

  saveStateSnapshot();
  showToast('Session started! QR is live.', 'success');
}

function generateNewQR() {
  if (!STATE.session) return;
  const token  = generateId(16);
  const expiry = Date.now() + QR_REFRESH_SECS * 1000 + 2000;
  STATE.session.qrToken  = token;
  STATE.session.qrExpiry = expiry;

  const s = STATE.session;
  const payload = JSON.stringify({
    sid:  s.id,
    tok:  token,
    exp:  expiry,
    crs:  s.course,
    pin:  s.pin,
    lat:  s.lat,
    lng:  s.lng,
    geo:  s.settings.geo,
    rad:  s.settings.geoRadius,
    dev:  s.settings.device,
    slf:  s.settings.selfie,
    v:    APP_VERSION,
  });

  DOM.qrSessionCode.textContent = s.id.slice(0, 8).toUpperCase();

  try {
    new QRious({
      element:    DOM.qrCanvas,
      value:      payload,
      size:       220,
      level:      'H',
      background: '#ffffff',
      foreground: '#0d1630',
      padding:    12,
    });
  } catch(e) { console.error('QR gen error', e); }

  saveStateSnapshot();
}

function updateSessionTimer() {
  if (!STATE.session) return;
  const rem = STATE.session.endsAt - Date.now();
  if (rem <= 0) { DOM.activeTimeLeft.textContent = 'Ended'; return; }
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  DOM.activeTimeLeft.textContent = `${m}m ${s.toString().padStart(2,'0')}s`;
}

function endSession(silent) {
  clearInterval(STATE.qrInterval);
  clearInterval(STATE.sessionTimer);
  STATE.qrInterval = STATE.sessionTimer = null;
  STATE.session    = null;
  DOM.startSessionArea.style.display  = '';
  DOM.activeSessionArea.style.display = 'none';
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot inactive"></span> Inactive';
  DOM.statSession.textContent         = '—';
  DOM.activeTimeLeft.textContent      = '—';
  DOM.spotCheckPanel.classList.add('hidden');
  if (!silent) showToast('Session ended', 'info');
  saveStateSnapshot();
}

// ═══════════════════════════════════════════════════
//  SPOT CHECKS
// ═══════════════════════════════════════════════════
DOM.triggerSpotCheckBtn.addEventListener('click', triggerSpotCheck);

function triggerSpotCheck() {
  if (!STATE.attendance.length) { showToast('No attendees to check yet', 'error'); return; }
  const eligible  = STATE.attendance.filter(r => !r.spotChecked);
  const count     = Math.max(1, Math.ceil(eligible.length * SPOT_CHECK_PCT));
  const selected  = shuffleArray([...eligible]).slice(0, count);

  if (selected.length === 0) { showToast('All students have been spot-checked', 'info'); return; }

  DOM.spotCheckList.innerHTML = selected.map(r => `
    <div class="spot-check-item" id="sc_${r.matric}">
      <div class="spot-check-student">
        <strong>${escHtml(r.name)}</strong>
        <span>${escHtml(r.matric || '—')}</span>
      </div>
      <div class="spot-check-actions">
        <button class="btn-spot-present" onclick="resolveSpotCheck('${r.matric}', true)">✓ Present</button>
        <button class="btn-spot-absent"  onclick="resolveSpotCheck('${r.matric}', false)">✗ Absent</button>
      </div>
    </div>`).join('');

  // Notify via BroadcastChannel so student tabs can show the notification
  broadcastSpotCheck(selected.map(r => r.matric));
  showToast(`Spot checking ${selected.length} student${selected.length > 1 ? 's' : ''}`, 'info');
}

window.resolveSpotCheck = function(matric, present) {
  const rec = STATE.attendance.find(r => r.matric === matric);
  if (rec) {
    rec.spotChecked = true;
    rec.spotResult  = present ? 'confirmed' : 'absent';
    if (!present) rec.flagged = true;
  }
  const el = $(`sc_${matric}`);
  if (el) {
    el.querySelector('.spot-check-actions').innerHTML =
      `<span class="spot-result-chip ${present ? 'confirmed' : 'absent'}">${present ? '✓ Confirmed' : '✗ Absent'}</span>`;
  }
  renderAttendanceTable();
  updateStats();
  saveStateSnapshot();
};

// ═══════════════════════════════════════════════════
//  ATTENDANCE LOG (LECTURER)
// ═══════════════════════════════════════════════════
function addAttendanceRecord(record) {
  const dup = STATE.attendance.find(r => r.matric === record.matric);
  if (dup) return false;
  STATE.attendance.push(record);
  renderAttendanceTable();
  updateStats();
  saveStateSnapshot();
  return true;
}

function renderAttendanceTable() {
  const tbody = DOM.attendanceBody;
  if (STATE.attendance.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row"><td colspan="7">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          <p>No students checked in yet</p>
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.attendance.map((r, i) => {
    let statusHtml;
    if (r.spotResult === 'absent') {
      statusHtml = `<span class="status-chip suspicious">✗ Absent</span>`;
    } else if (r.flagged) {
      statusHtml = `<span class="status-chip suspicious">⚠ Flagged</span>`;
    } else if (r.spotResult === 'confirmed') {
      statusHtml = `<span class="status-chip present">✓ Verified</span>`;
    } else {
      statusHtml = `<span class="status-chip present">✓ Present</span>`;
    }
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(r.name)}</td>
        <td>${escHtml(r.matric || '—')}</td>
        <td>${formatTime(new Date(r.timestamp))}</td>
        <td>${r.distance != null ? r.distance + 'm' : '—'}</td>
        <td><span class="device-tag">${r.deviceId || '—'}</span></td>
        <td>${statusHtml}</td>
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
  confirmModal('Clear Attendance?', 'This will remove all records from the current log.', () => {
    STATE.attendance = [];
    renderAttendanceTable();
    updateStats();
    saveStateSnapshot();
  });
});

// ═══════════════════════════════════════════════════
//  EXPORT TO EXCEL
// ═══════════════════════════════════════════════════
DOM.exportBtn.addEventListener('click', exportExcel);

function exportExcel() {
  if (STATE.attendance.length === 0) { showToast('No records to export', 'error'); return; }
  const course  = STATE.session?.course || STATE.attendance[0]?.course || 'Course';
  const dateStr = new Date().toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
  const title   = `SCHOOLER Attendance — ${course} — ${dateStr}`;

  const headerRows = [
    [title], [],
    ['#','Student Name','Matric No.','Check-in Time','Distance','Device ID','Status','Spot Check'],
  ];
  const dataRows = STATE.attendance.map((r, i) => [
    i + 1,
    r.name, r.matric || 'N/A',
    formatTime(new Date(r.timestamp)),
    r.distance != null ? `${r.distance}m` : 'N/A',
    r.deviceId || 'N/A',
    r.spotResult === 'absent' ? 'Absent (Spot Check)' : r.flagged ? 'Flagged' : 'Present',
    r.spotResult ? (r.spotResult === 'confirmed' ? 'Verified' : 'Absent') : 'Not checked',
  ]);
  const summaryRows = [
    [], ['Summary'],
    ['Total Present', STATE.attendance.length],
    ['Flagged', STATE.attendance.filter(r=>r.flagged).length],
    ['Session Course', course],
    ['Export Date', new Date().toLocaleString('en-NG')],
    ['Generated by', 'SCHOOLER v' + APP_VERSION],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, ...summaryRows]);
  ws['!cols'] = [{wch:4},{wch:26},{wch:20},{wch:18},{wch:12},{wch:18},{wch:20},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `SCHOOLER_${course.replace(/\s/g,'_')}_${Date.now()}.xlsx`);
  showToast('Excel file downloaded!', 'success');
}

// ═══════════════════════════════════════════════════
//  QR SCANNER (STUDENT)
// ═══════════════════════════════════════════════════
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
    showToast('Scanner active', 'info');
  } catch(e) {
    showToast('Camera access denied. Use manual code below.', 'error');
  }
}

function scanFrame() {
  if (!STATE.scanActive) return;
  const video = DOM.scannerVideo;
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    STATE.scanAnimFrame = requestAnimationFrame(scanFrame); return;
  }
  const canvas  = DOM.scannerCanvas;
  const ctx     = canvas.getContext('2d');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
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
  try { payload = JSON.parse(raw); } catch(e) {
    showStudentError('Invalid QR Code', 'This QR code is not from SCHOOLER.'); return;
  }
  if (!payload.sid || !payload.tok || !payload.exp) {
    showStudentError('Invalid QR Code', 'QR data is malformed.'); return;
  }
  // Expiry check
  if (Date.now() > payload.exp) {
    showStudentError('QR Code Expired', 'This QR has expired — they refresh every 10 seconds. Ask the lecturer to show the current code.'); return;
  }

  // Device binding check
  if (payload.dev) {
    const check = checkDeviceBinding(STATE.user?.matric || 'guest');
    if (!check.bound) {
      showStudentError('Device Not Authorised', 'This account is registered on another device. Request approval to switch devices.'); return;
    }
  }

  let distRounded = null;

  // Geolocation check (only if session enabled it)
  if (payload.geo && payload.lat && payload.lng) {
    let studentCoords;
    try {
      showToast('Verifying location…', 'info');
      studentCoords = await getGeolocation();
    } catch(e) {
      showStudentError('Location Required', 'Enable location services to mark attendance. This prevents remote check-ins.'); return;
    }
    if (studentCoords.accuracy > 150) {
      showStudentError('Weak GPS Signal', `GPS accuracy is ${Math.round(studentCoords.accuracy)}m. Move closer to a window and try again.`); return;
    }
    const dist = haversineDistance(studentCoords.latitude, studentCoords.longitude, payload.lat, payload.lng);
    distRounded = Math.round(dist);
    if (dist > (payload.rad || 50)) {
      showStudentError('Too Far Away', `You are ${distRounded}m from the classroom. You must be within ${payload.rad || 50}m to mark attendance.`); return;
    }
  }

  const record = {
    name:      STATE.user.name,
    matric:    STATE.user.matric || '',
    course:    payload.crs,
    timestamp: Date.now(),
    distance:  distRounded,
    sessionId: payload.sid,
    deviceId:  getDeviceShort(),
    flagged:   false,
    spotChecked: false,
    spotResult: null,
  };

  // Try to deliver — queue offline if no connectivity
  if (!STATE.isOnline) {
    queueOfflineRecord(record);
    record.offlineQueued = true;
  } else {
    broadcastAttendance(record);
    relayAttendance(record);
  }

  // Log to student history
  STATE.studentHistory.unshift({ course: payload.crs, timestamp: record.timestamp, status: STATE.isOnline ? 'present' : 'offline' });
  renderStudentHistory();
  saveStateSnapshot();
  showStudentSuccess(record, distRounded);
}

function handleManualCode() {
  const raw = DOM.manualCode.value.trim();
  if (!raw) { showToast('Enter a session code', 'error'); return; }
  const relay = localStorage.getItem('schooler_session');
  if (!relay) { showToast('No active session found', 'error'); return; }
  try {
    const session = JSON.parse(relay);
    if (session.id.slice(0,8).toUpperCase() === raw.toUpperCase() || session.pin === raw.toUpperCase()) {
      const fakePayload = JSON.stringify({
        sid: session.id, tok: session.qrToken, exp: session.qrExpiry,
        crs: session.course, pin: session.pin,
        lat: session.lat, lng: session.lng,
        geo: session.settings?.geo ?? false,
        rad: session.settings?.geoRadius ?? 50,
        dev: session.settings?.device ?? true,
        slf: session.settings?.selfie ?? false,
        v: APP_VERSION,
      });
      handleQRData(fakePayload);
    } else {
      showToast('Code does not match any active session', 'error');
    }
  } catch(e) { showToast('Could not verify code', 'error'); }
}

// ─── Student history
function renderStudentHistory() {
  if (!STATE.studentHistory.length) return;
  const present = STATE.studentHistory.filter(h => h.status !== 'absent').length;
  const pct     = Math.round((present / STATE.studentHistory.length) * 100);
  DOM.historyRate.textContent = `${pct}% attendance`;
  DOM.historyList.innerHTML   = STATE.studentHistory.map(h => `
    <div class="history-item">
      <div>
        <div class="history-course">${escHtml(h.course)}</div>
        <div class="history-time">${formatTime(new Date(h.timestamp))}</div>
      </div>
      <span class="history-status ${h.status}">${h.status === 'offline' ? '⏳ Pending Sync' : '✓ Present'}</span>
    </div>`).join('');
}

// ─── Student status display
function showStudentSuccess(record, dist) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className     = 'status-icon success';
  DOM.statusIcon.innerHTML     = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  DOM.statusTitle.textContent  = record.offlineQueued ? 'Saved Locally!' : 'Attendance Marked!';
  DOM.statusMsg.textContent    = record.offlineQueued
    ? 'Your attendance has been saved locally and will sync once internet access is restored.'
    : 'You have been successfully recorded for this session.';
  DOM.statusMeta.innerHTML     = `
    <span>📚 ${escHtml(record.course)}</span>
    <span>⏱ ${formatTime(new Date(record.timestamp))}</span>
    ${dist != null ? `<span>📍 ${dist}m from classroom</span>` : ''}
    <span>👤 ${escHtml(record.name)} · ${escHtml(record.matric)}</span>
    <span>📱 Device: ${record.deviceId}</span>`;
  showToast(record.offlineQueued ? 'Saved offline — will sync later' : 'Attendance recorded!', 'success');
}

function showStudentError(title, msg) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className     = 'status-icon error';
  DOM.statusIcon.innerHTML     = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  DOM.statusTitle.textContent  = title;
  DOM.statusMsg.textContent    = msg;
  DOM.statusMeta.innerHTML     = '';
  showToast(title, 'error');
}

function resetStudentScan() {
  DOM.statusCard.classList.add('hidden');
  DOM.scanCard.classList.remove('hidden');
  DOM.manualCode.value = '';
}

// ═══════════════════════════════════════════════════
//  BROADCAST / RELAY
// ═══════════════════════════════════════════════════
let bc;
try { bc = new BroadcastChannel('schooler_attendance'); } catch(e) { bc = null; }

function broadcastAttendance(record) { if (bc) bc.postMessage({ type: 'attendance', record }); }
function broadcastSpotCheck(matricList) { if (bc) bc.postMessage({ type: 'spot_check', matricList }); }

if (bc) {
  bc.onmessage = (event) => {
    if (event.data?.type === 'attendance' && STATE.role === 'lecturer') {
      const rec = event.data.record;
      if (STATE.session && rec.sessionId === STATE.session.id) {
        const added = addAttendanceRecord(rec);
        if (added) showToast(`${rec.name} checked in${rec.distance != null ? ' ('+rec.distance+'m)':''}`, 'success');
      }
    }
    if (event.data?.type === 'spot_check' && STATE.role === 'student' && STATE.user) {
      if (event.data.matricList.includes(STATE.user.matric)) {
        DOM.spotCheckNotification.classList.remove('hidden');
        setTimeout(() => DOM.spotCheckNotification.classList.add('hidden'), 15000);
      }
    }
  };
}

function relayAttendance(record) {
  localStorage.setItem('schooler_checkin', JSON.stringify({ record, ts: Date.now() }));
}

setInterval(() => {
  if (STATE.role !== 'lecturer' || !STATE.session) return;
  const raw = localStorage.getItem('schooler_checkin');
  if (!raw) return;
  try {
    const { record, ts } = JSON.parse(raw);
    if (Date.now() - ts > 20000) return;
    if (record.sessionId === STATE.session.id) {
      const added = addAttendanceRecord(record);
      if (added) {
        showToast(`${record.name} checked in${record.distance != null ? ' ('+record.distance+'m)':''}`, 'success');
        localStorage.removeItem('schooler_checkin');
      }
    }
  } catch(e) {}
}, 1500);

// ═══════════════════════════════════════════════════
//  GEOLOCATION
// ═══════════════════════════════════════════════════
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const toRad = d => d * Math.PI / 180;

// ═══════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════
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

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = STATE.user?.course || '';
    showScreen('lecturer');
    renderAttendanceTable();
    updateStats();

    if (saved.session && saved.session.endsAt > Date.now()) {
      STATE.session = saved.session;
      DOM.startSessionArea.style.display  = 'none';
      DOM.activeSessionArea.style.display = '';
      DOM.activeCourseName.textContent    = STATE.session.course;
      DOM.activeStartTime.textContent     = formatTime(new Date(STATE.session.startedAt));
      DOM.activePIN.textContent           = STATE.session.pin;
      DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
      DOM.statSession.textContent         = STATE.session.course;

      const s = STATE.session.settings || {};
      DOM.geoStatusDisplay.innerHTML = s.geo
        ? `<span class="dot green-dot"></span> Active (${s.geoRadius}m radius)`
        : `<span class="dot" style="background:var(--text-muted)"></span> Disabled`;
      const checks = ['QR'];
      if (s.device)    checks.push('Device');
      if (s.spotCheck) checks.push('Spot Checks');
      if (s.geo)       checks.push('Geo');
      if (s.ble)       checks.push('BLE');
      if (s.selfie)    checks.push('Selfie');
      DOM.activeChecksDisplay.innerHTML = `<div class="checks-list">${checks.map(c=>`<span class="check-chip">${c}</span>`).join('')}</div>`;
      DOM.spotCheckPanel.classList.toggle('hidden', !s.spotCheck);

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
        if (Date.now() >= STATE.session.endsAt) { endSession(false); showToast('Session time expired','info'); }
      }, 1000);
      showToast(`Session restored — ${STATE.session.course}`, 'info');
    }
  } else if (STATE.role === 'student') {
    DOM.studentName.textContent          = STATE.user.name;
    DOM.studentMatricDisplay.textContent = STATE.user.matric ? `${STATE.user.matric} · ${STATE.user.course}` : STATE.user.course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    renderStudentHistory();
    showScreen('student');
    updateOfflineUI();
    syncOfflineQueue();
    showToast(`Welcome back, ${STATE.user.name}`, 'info');
  } else {
    showScreen('auth');
  }
}

// ═══════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  DOM.toast.textContent = msg;
  DOM.toast.className   = `toast ${type}`;
  DOM.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), 3500);
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
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function generatePIN() {
  const n = new Uint8Array(3), l = new Uint8Array(3);
  crypto.getRandomValues(n); crypto.getRandomValues(l);
  return Array.from(n, b => b % 10).join('') + '-' + Array.from(l, b => String.fromCharCode(65 + b % 26)).join('');
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ═══════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[SCHOOLER] SW registered'))
      .catch(e => console.warn('[SCHOOLER] SW failed:', e));
  });
}
