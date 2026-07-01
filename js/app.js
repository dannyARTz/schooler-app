/* ═══════════════════════════════════════════════════
   SCHOOLER  app.js  v2.0 — complete clean rewrite
   ═══════════════════════════════════════════════════ */
'use strict';

// ─── STATE ───────────────────────────────────────
const STATE = {
  role:           null,
  user:           null,      // { name, email, matric, course, googleEmail }
  googleProfile:  null,      // { name, email, picture } — students only
  session:        null,
  attendance:     [],
  studentHistory: [],
  offlineQueue:   [],
  qrInterval:     null,
  sessionTimer:   null,
  scanActive:     false,
  scanStream:     null,
  scanAnimFrame:  null,
  selfieStream:   null,
  theme:          'dark',
  isOnline:       navigator.onLine,
  deviceId:       null,
  sheetsReady:    false,
  bleBeaconActive:false,
  liveSheetToken: null,
};

// ─── CONSTANTS ────────────────────────────────────
const QR_SECS      = 10;
const APP_VER      = '2.0';
const STORE_KEY    = 'schooler_v2';
const SPOT_PCT     = 0.05;

// ─── DOM REFS (populated after DOMContentLoaded) ──
const $  = id => document.getElementById(id);
let DOM  = {};

function initDOM() {
  DOM = {
    splash:                $('splash'),
    authScreen:            $('authScreen'),
    completionScreen:      $('completionScreen'),
    lecturerDash:          $('lecturerDashboard'),
    studentDash:           $('studentDashboard'),
    // Auth
    roleTabs:              document.querySelectorAll('.role-tab'),
    lecturerNameGroup:     $('lecturerNameGroup'),
    authName:              $('authName'),
    studentSSOGroup:       $('studentSSOGroup'),
    googleSignInBtn:       $('googleSignInBtn'),
    studentVerifiedCard:   $('studentVerifiedCard'),
    studentVerifiedAvatar: $('studentVerifiedAvatar'),
    studentVerifiedName:   $('studentVerifiedName'),
    studentVerifiedEmail:  $('studentVerifiedEmail'),
    studentSwitchAccountBtn: $('studentSwitchAccountBtn'),
    ssoFallbackBtn:        $('ssoFallbackBtn'),
    ssoError:              $('ssoError'),
    ssoErrorText:          $('ssoErrorText'),
    matricGroup:           $('matricGroup'),
    courseGroup:           $('courseGroup'),
    authMatric:            $('authMatric'),
    authCourse:            $('authCourse'),
    gasUrlGroup:           $('gasUrlGroup'),
    gasUrlInput:           $('gasUrlInput'),
    gasUrlNote:            $('gasUrlNote'),
    authDept:              $('authDept'),
    deviceWarning:         $('deviceWarning'),
    authBtn:               $('authBtn'),
    // Lecturer nav
    sheetsSyncBadge:       $('sheetsSyncBadge'),
    sheetsSyncText:        $('sheetsSyncText'),
    sheetsSyncStatus:      $('sheetsSyncStatus'),
    offlineBadge:          $('offlineBadge'),
    lecturerUserPill:      $('lecturerUserPill'),
    lecturerAvatar:        $('lecturerAvatar'),
    lecturerDisplayName:   $('lecturerDisplayName'),
    themeToggle:           $('themeToggle'),
    themeIconDark:         $('themeIconDark'),
    themeIconLight:        $('themeIconLight'),
    lecturerLogout:        $('lecturerLogout'),
    // Stats
    statTotal:             $('statTotal'),
    statRate:              $('statRate'),
    statFlagged:           $('statFlagged'),
    statSession:           $('statSession'),
    // Session
    sessionCourse:         $('sessionCourse'),
    sessionDuration:       $('sessionDuration'),
    settingQR:             $('settingQR'),
    settingDevice:         $('settingDevice'),
    settingSpotCheck:      $('settingSpotCheck'),
    settingGeo:            $('settingGeo'),
    geoRadiusField:        $('geoRadiusField'),
    geoRadius:             $('geoRadius'),
    settingBLE:            $('settingBLE'),
    settingSelfie:         $('settingSelfie'),
    startSessionBtn:       $('startSessionBtn'),
    startSessionArea:      $('startSessionArea'),
    activeSessionArea:     $('activeSessionArea'),
    sessionStatusBadge:    $('sessionStatusBadge'),
    // QR
    qrCanvas:              $('qrCanvas'),
    countdownNum:          $('countdownNum'),
    qrSessionCode:         $('qrSessionCode'),
    qrWrapper:             document.querySelector('.qr-wrapper'),
    // Active session info
    activeCourseName:      $('activeCourseName'),
    activeSessionDate:     $('activeSessionDate'),
    activeStartTime:       $('activeStartTime'),
    activeTimeLeft:        $('activeTimeLeft'),
    geoStatusDisplay:      $('geoStatusDisplay'),
    sheetsSyncStatus_s:    $('sheetsSyncStatus'),
    activeChecksDisplay:   $('activeChecksDisplay'),
    activePIN:             $('activePIN'),
    endSessionBtn:         $('endSessionBtn'),
    bleBeaconBtn:          $('bleBeaconBtn'),
    bleBeaconText:         $('bleBeaconText'),
    // Spot check
    spotCheckPanel:        $('spotCheckPanel'),
    spotCheckList:         $('spotCheckList'),
    triggerSpotCheckBtn:   $('triggerSpotCheckBtn'),
    // Table
    attendanceBody:        $('attendanceBody'),
    exportBtn:             $('exportBtn'),
    clearAttendanceBtn:    $('clearAttendanceBtn'),
    // Student nav
    offlineBadgeStudent:   $('offlineBadgeStudent'),
    studentUserPill:       $('studentUserPill'),
    studentNavAvatar:      $('studentNavAvatar'),
    studentNavName:        $('studentNavName'),
    themeToggleStudent:    $('themeToggleStudent'),
    studentLogout:         $('studentLogout'),
    // Student main
    offlineQueueBanner:    $('offlineQueueBanner'),
    spotCheckNotification: $('spotCheckNotification'),
    studentHeroAvatar:     $('studentHeroAvatar'),
    studentHeroIcon:       $('studentHeroIcon'),
    studentName:           $('studentName'),
    studentMatricDisplay:  $('studentMatricDisplay'),
    deviceChip:            $('deviceChip'),
    // Scanner
    scanCard:              $('scanCard'),
    scanSubtitle:          $('scanSubtitle'),
    sheetsPollingBar:      $('sheetsPollingBar'),
    scannerVideo:          $('scannerVideo'),
    scannerCanvas:         $('scannerCanvas'),
    scanHint:              $('scanHint'),
    startScanBtn:          $('startScanBtn'),
    manualCode:            $('manualCode'),
    manualSubmitBtn:       $('manualSubmitBtn'),
    // Status card
    statusCard:            $('statusCard'),
    statusIcon:            $('statusIcon'),
    statusTitle:           $('statusTitle'),
    statusMsg:             $('statusMsg'),
    statusMeta:            $('statusMeta'),
    scanAgainBtn:          $('scanAgainBtn'),
    // History
    historyList:           $('historyList'),
    historyRate:           $('historyRate'),
    // Selfie
    selfieModal:           $('selfieModal'),
    selfieVideo:           $('selfieVideo'),
    selfieCanvas:          $('selfieCanvas'),
    selfieCaptureBtn:      $('selfieCaptureBtn'),
    selfieCancelBtn:       $('selfieCancelBtn'),
    // UI
    toast:                 $('toast'),
    modal:                 $('modal'),
    modalTitle:            $('modalTitle'),
    modalMsg:              $('modalMsg'),
    modalCancel:           $('modalCancel'),
    modalConfirm:          $('modalConfirm'),
  };
}

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initDOM();
  loadTheme();
  initDeviceId();
  initNetworkListeners();
  wireEvents();
  setTimeout(boot, 1900);
});

function boot() {
  DOM.splash.classList.add('fade-out');
  setTimeout(() => {
    DOM.splash.style.display = 'none';
    const saved = loadState();
    if (saved && saved.role && saved.user) {
      restoreSession(saved);
    } else {
      showScreen('auth');
      // pre-fill saved GAS URL if present
      const savedUrl = gasGetUrl();
      if (savedUrl && DOM.gasUrlInput) DOM.gasUrlInput.value = savedUrl;
    }
  }, 400);
}

// ═══════════════════════════════════════════════════
//  WIRE ALL EVENTS (called once after initDOM)
// ═══════════════════════════════════════════════════
function wireEvents() {
  // Theme
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.themeToggleStudent.addEventListener('click', toggleTheme);

  // Settings geo toggle
  DOM.settingGeo.addEventListener('change', () => {
    DOM.geoRadiusField.classList.toggle('hidden', !DOM.settingGeo.checked);
  });

  // Role tabs
  DOM.roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedRole = tab.dataset.role;
      DOM.deviceWarning.classList.add('hidden');
      updateAuthForm();
    });
  });

  // SSO buttons
  DOM.studentSwitchAccountBtn.addEventListener('click', switchGoogleAccount);
  DOM.ssoFallbackBtn.addEventListener('click', ssoFallback);

  // Auth submit
  DOM.authBtn.addEventListener('click', handleAuth);

  // Logouts
  DOM.lecturerLogout.addEventListener('click', () => {
    confirmModal('Sign out?', 'Any active session will end.', () => {
      endSession(true);
      bleStopBeacon();
      clearState();
      resetToAuth();
    });
  });
  DOM.studentLogout.addEventListener('click', () => {
    stopScanner();
    sheetsStopPolling();
    clearState();
    resetToAuth();
  });

  // Session
  DOM.startSessionBtn.addEventListener('click', startSession);
  DOM.endSessionBtn.addEventListener('click', () => {
    confirmModal('End Session?', 'Students can no longer check in.', () => endSession(false));
  });

  // Spot check
  DOM.triggerSpotCheckBtn.addEventListener('click', triggerSpotCheck);

  // Attendance
  DOM.clearAttendanceBtn.addEventListener('click', () => {
    confirmModal('Clear Log?', 'Removes from this view only — Sheets data kept.', () => {
      STATE.attendance = [];
      renderTable();
      updateStats();
      saveState();
    });
  });
  DOM.exportBtn.addEventListener('click', exportExcel);

  // Scanner
  DOM.startScanBtn.addEventListener('click', startScanner);
  DOM.scanAgainBtn.addEventListener('click', resetScan);
  DOM.manualSubmitBtn.addEventListener('click', handleManualCode);

  // Modal
  DOM.modalCancel.addEventListener('click', () => DOM.modal.classList.add('hidden'));
}

// ═══════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════
function loadTheme() {
  applyTheme(localStorage.getItem('schooler_theme') || 'dark');
}
function applyTheme(t) {
  STATE.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('schooler_theme', t);
  const dark = t === 'dark';
  DOM.themeIconDark.style.display  = dark ? '' : 'none';
  DOM.themeIconLight.style.display = dark ? 'none' : '';
}
function toggleTheme() { applyTheme(STATE.theme === 'dark' ? 'light' : 'dark'); }

// ═══════════════════════════════════════════════════
//  NETWORK
// ═══════════════════════════════════════════════════
function initNetworkListeners() {
  window.addEventListener('online',  () => { STATE.isOnline = true;  refreshOfflineUI(); syncQueue(); });
  window.addEventListener('offline', () => { STATE.isOnline = false; refreshOfflineUI(); });
  refreshOfflineUI();
}
function refreshOfflineUI() {
  const off = !STATE.isOnline;
  DOM.offlineBadge?.classList.toggle('hidden', !off);
  DOM.offlineBadgeStudent?.classList.toggle('hidden', !off);
  DOM.offlineQueueBanner?.classList.toggle('hidden', STATE.offlineQueue.length === 0 || !off);
}
async function syncQueue() {
  if (!STATE.isOnline || !STATE.offlineQueue.length || !gasIsReady()) return;
  const q = [...STATE.offlineQueue];
  STATE.offlineQueue = [];
  for (const r of q) {
    try { await gasSubmitAttendance(r); }
    catch(e) { STATE.offlineQueue.push(r); }
  }
  saveState();
  refreshOfflineUI();
  if (!STATE.offlineQueue.length) toast('Offline records synced ✓', 'success');
}

// ═══════════════════════════════════════════════════
//  DEVICE ID — stable fingerprint
// ═══════════════════════════════════════════════════
function initDeviceId() {
  let id = localStorage.getItem('schooler_did') || sessionStorage.getItem('schooler_did_bk');
  if (!id) {
    const fp = [navigator.userAgent, screen.width, screen.height,
                screen.colorDepth, navigator.language,
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                navigator.hardwareConcurrency || 0].join('|');
    let h = 0;
    for (let i = 0; i < fp.length; i++) { h = Math.imul(31, h) + fp.charCodeAt(i) | 0; }
    id = generateId(14) + '_' + Math.abs(h).toString(36).toUpperCase();
  }
  STATE.deviceId = id;
  localStorage.setItem('schooler_did', id);
  sessionStorage.setItem('schooler_did_bk', id);
}
function deviceShort() {
  if (!STATE.deviceId) return 'UNK';
  const p = STATE.deviceId.split('_');
  return p[p.length - 1];
}

// ═══════════════════════════════════════════════════
//  DEVICE BINDING (per-matric, per-session per day)
// ═══════════════════════════════════════════════════
function todayKey() { return new Date().toISOString().slice(0, 10); }
function deviceSeenKey(matric, sid) { return `sch_seen_${matric}_${sid}_${todayKey()}`; }
function hasDeviceSeen(matric, sid) { return !!localStorage.getItem(deviceSeenKey(matric, sid)); }
function markDeviceSeen(matric, sid) { localStorage.setItem(deviceSeenKey(matric, sid), '1'); }

function checkDeviceBinding(matric) {
  const k = `sch_bind_${matric}`;
  const b = localStorage.getItem(k);
  if (!b) return { bound: true, isNewBind: true };
  if (b === STATE.deviceId) return { bound: true, isNewBind: false };
  const chk = localStorage.getItem(`sch_chk_${matric}`);
  const daysSince = chk ? (Date.now() - Number(chk)) / 86400000 : 999;
  return { bound: false, daysSince };
}
function bindDevice(matric) {
  localStorage.setItem(`sch_bind_${matric}`, STATE.deviceId);
  localStorage.setItem(`sch_chk_${matric}`, String(Date.now()));
}

// ═══════════════════════════════════════════════════
//  SCREEN ROUTING
// ═══════════════════════════════════════════════════
function showScreen(name) {
  DOM.authScreen.classList.add('hidden');
  DOM.completionScreen.classList.add('hidden');
  DOM.lecturerDash.classList.add('hidden');
  DOM.studentDash.classList.add('hidden');
  if (name === 'auth')     DOM.authScreen.classList.remove('hidden');
  if (name === 'lecturer') DOM.lecturerDash.classList.remove('hidden');
  if (name === 'student')  DOM.studentDash.classList.remove('hidden');
}
function resetToAuth() {
  STATE.role = null; STATE.user = null; STATE.googleProfile = null;
  STATE.sheetsReady = false;
  showScreen('auth');
  const savedUrl = gasGetUrl();
  if (savedUrl && DOM.gasUrlInput) DOM.gasUrlInput.value = savedUrl;
  DOM.gasUrlNote.style.display = savedUrl ? '' : 'none';
}

// ═══════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════
let selectedRole = 'lecturer';

function updateAuthForm() {
  const isStudent = selectedRole === 'student';
  DOM.lecturerNameGroup.style.display = isStudent ? 'none' : '';
  DOM.studentSSOGroup.style.display   = isStudent ? '' : 'none';
  DOM.matricGroup.style.display       = isStudent ? '' : 'none';
  DOM.courseGroup.style.display       = isStudent ? '' : 'none';
  DOM.gasUrlGroup.style.display       = isStudent ? 'none' : '';
  DOM.authBtn.textContent             = isStudent ? 'Enter SCHOOLER' : 'Connect & Enter';
  if (isStudent) initGoogleSSO();
}

// ─── Google SSO (student identity) ───────────────
function initGoogleSSO() {
  const cid = window.SCHOOLER_CLIENT_ID;
  if (typeof google === 'undefined' || !google.accounts) {
    DOM.ssoFallbackBtn.style.display = '';
    return;
  }
  if (!cid || cid === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
    renderDevSSO(); return;
  }
  DOM.googleSignInBtn.innerHTML = '';
  google.accounts.id.initialize({ client_id: cid, callback: onGoogleCredential, auto_select: false });
  google.accounts.id.renderButton(DOM.googleSignInBtn, {
    type: 'standard', theme: STATE.theme === 'dark' ? 'filled_black' : 'outline',
    size: 'large', text: 'continue_with', width: 300,
  });
}

function onGoogleCredential(resp) {
  try {
    const parts   = resp.credential.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    setStudentVerified({ name: payload.name, email: payload.email, picture: payload.picture });
  } catch(e) {
    DOM.ssoErrorText.textContent = 'Could not read Google profile. Please try again.';
    DOM.ssoError.classList.remove('hidden');
  }
}

function setStudentVerified(profile) {
  STATE.googleProfile = profile;
  DOM.studentVerifiedAvatar.src       = profile.picture || '';
  DOM.studentVerifiedName.textContent  = profile.name;
  DOM.studentVerifiedEmail.textContent = profile.email;
  DOM.googleSignInBtn.style.display    = 'none';
  DOM.studentVerifiedCard.classList.remove('hidden');
  DOM.ssoError.classList.add('hidden');
}

function switchGoogleAccount() {
  STATE.googleProfile = null;
  DOM.studentVerifiedCard.classList.add('hidden');
  DOM.googleSignInBtn.style.display = '';
  DOM.googleSignInBtn.innerHTML = '';
  initGoogleSSO();
}

function ssoFallback() {
  setStudentVerified({ name: 'Local User', email: 'local@schooler.app', picture: '' });
  toast('Running without Google verification', 'info');
}

function renderDevSSO() {
  DOM.googleSignInBtn.innerHTML = `
    <div class="dev-mode-notice">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Dev mode — no Client ID set
    </div>
    <input type="text" id="devName" placeholder="Your name" class="dev-input" style="margin-top:8px"/>
    <button class="btn-primary full-width" id="devGoBtn" style="margin-top:8px">Use this name</button>`;
  document.getElementById('devGoBtn').addEventListener('click', () => {
    const n = document.getElementById('devName').value.trim();
    if (!n) { toast('Enter a name', 'error'); return; }
    setStudentVerified({ name: n, email: `${n.toLowerCase().replace(/\s+/g,'.')}@dev.local`, picture: '' });
  });
}

// ─── Submit auth ──────────────────────────────────
async function handleAuth() {
  if (selectedRole === 'lecturer') {
    const name   = DOM.authName.value.trim();
    const rawUrl = DOM.gasUrlInput.value.trim() || gasGetUrl() || '';
    if (!name)   { toast('Please enter your name', 'error'); return; }
    if (!rawUrl) { toast('Please paste your Apps Script URL', 'error'); return; }

    DOM.authBtn.textContent = 'Connecting…';
    DOM.authBtn.disabled    = true;
    try {
      gasSetUrl(rawUrl);
      await gasPing();
      STATE.sheetsReady = true;
      DOM.gasUrlNote.style.display = '';
      toast('Connected to Google Sheets ✓', 'success');
    } catch(e) {
      gasSetUrl(null);
      toast(`Connection failed: ${e.message}`, 'error');
      DOM.authBtn.textContent = 'Connect & Enter';
      DOM.authBtn.disabled    = false;
      return;
    }
    DOM.authBtn.textContent = 'Connect & Enter';
    DOM.authBtn.disabled    = false;

    STATE.role = 'lecturer';
    STATE.user = { name, course: '', matric: '', googleEmail: '' };
    saveState();
    DOM.sessionCourse.value = '';
    renderTable(); updateStats();
    setNavUser('lecturer', name, '');
    showScreen('lecturer');
    updateSheetsUI();
    toast(`Welcome, ${name.split(' ')[0]}`, 'success');
    return;
  }

  // ── Student ──
  if (!STATE.googleProfile) { toast('Please sign in with Google first', 'error'); return; }
  const matric = DOM.authMatric.value.trim();
  const course = DOM.authCourse.value.trim();
  if (!matric) { toast('Please enter your matric number', 'error'); return; }
  if (!course) { toast('Please enter your course code', 'error'); return; }

  const check = checkDeviceBinding(matric);
  if (check.bound === false) {
    if (check.daysSince < 30) {
      toast(`Device switch not allowed for ${Math.ceil(30 - check.daysSince)} more days`, 'error');
      return;
    }
    bindDevice(matric);
  }
  if (check.isNewBind) bindDevice(matric);

  STATE.role = 'student';
  STATE.user = {
    name:        STATE.googleProfile.name,
    googleEmail: STATE.googleProfile.email,
    picture:     STATE.googleProfile.picture,
    matric, course,
  };
  saveState();

  DOM.studentName.textContent          = STATE.user.name;
  DOM.studentMatricDisplay.textContent = `${matric} · ${course}`;
  DOM.deviceChip.title                 = `Device: ${deviceShort()}`;
  setNavUser('student', STATE.user.name, STATE.user.picture);
  setHeroAvatar(STATE.user.picture);
  renderHistory();
  if (gasIsReady()) startSheetsPoll();
  showScreen('student');
  syncQueue();
  toast(`Welcome, ${STATE.user.name.split(' ')[0]} — identity verified ✓`, 'success');
}

function setNavUser(role, name, picture) {
  const first = name.split(' ')[0];
  if (role === 'lecturer') {
    DOM.lecturerDisplayName.textContent = first;
    if (picture) { DOM.lecturerAvatar.src = picture; DOM.lecturerAvatar.style.display = ''; }
    DOM.lecturerUserPill.classList.remove('hidden');
  } else {
    DOM.studentNavName.textContent = first;
    if (picture) { DOM.studentNavAvatar.src = picture; DOM.studentNavAvatar.style.display = ''; }
    DOM.studentUserPill.classList.remove('hidden');
  }
}
function setHeroAvatar(picture) {
  if (picture) {
    DOM.studentHeroAvatar.src = picture;
    DOM.studentHeroAvatar.style.display = '';
    DOM.studentHeroIcon.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════
//  SHEETS STATUS UI
// ═══════════════════════════════════════════════════
function updateSheetsUI() {
  const ok = STATE.sheetsReady;
  DOM.sheetsSyncBadge?.classList.toggle('synced', ok);
  if (DOM.sheetsSyncText) DOM.sheetsSyncText.textContent = ok ? '✓ Sheets' : 'Local Only';
}
function setSyncStatus(s) {
  DOM.sheetsSyncBadge.className = `sheets-badge ${s}`;
  const labels = { syncing: '⟳ Syncing', ok: '✓ Sheets', error: '✗ Sheets' };
  DOM.sheetsSyncText.textContent = labels[s] || 'Sheets';
  if (DOM.sheetsSyncStatus) DOM.sheetsSyncStatus.innerHTML = {
    syncing: '<span class="sync-idle">Syncing…</span>',
    ok:      `<span class="sync-ok">✓ ${formatTime(new Date())}</span>`,
    error:   '<span class="sync-err">✗ Failed</span>',
  }[s] || '—';
}
async function pushToSheets(action, payload) {
  if (!gasIsReady()) return null;
  try {
    setSyncStatus('syncing');
    const r = await sheetsRequest(action, payload);
    setSyncStatus('ok');
    return r;
  } catch(e) {
    setSyncStatus('error');
    console.warn('[GAS]', action, e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════
//  SESSION  (Lecturer)
// ═══════════════════════════════════════════════════
async function startSession() {
  const course   = DOM.sessionCourse.value.trim();
  const duration = parseInt(DOM.sessionDuration.value) || 60;
  if (!course) { toast('Enter a course code', 'error'); return; }

  const useGeo = DOM.settingGeo.checked;
  const useBLE = DOM.settingBLE.checked;
  const geoR   = parseInt(DOM.geoRadius.value) || 50;
  let   coords = null;

  if (useGeo) {
    try { coords = await getGeo(); }
    catch(e) {
      toast('Could not get location — geolocation disabled for this session', 'error');
      DOM.settingGeo.checked = false;
      DOM.geoRadiusField.classList.add('hidden');
    }
  }

  const settings = {
    qr: true,
    device:     DOM.settingDevice.checked,
    spotCheck:  DOM.settingSpotCheck.checked,
    geo:        useGeo && !!coords,
    geoRadius:  geoR,
    ble:        useBLE,
    selfie:     DOM.settingSelfie.checked,
  };

  const now = Date.now();
  STATE.session = {
    id: generateId(12), course, pin: generatePIN(),
    startedAt: now, endsAt: now + duration * 60000,
    date: todayKey(), duration,
    lat: coords?.latitude ?? null, lng: coords?.longitude ?? null,
    settings, qrToken: null, qrExpiry: null,
  };
  STATE.attendance = [];
  renderTable(); updateStats();

  // UI flip to active
  DOM.startSessionArea.style.display  = 'none';
  DOM.activeSessionArea.style.display = '';
  DOM.activeCourseName.textContent    = course;
  DOM.activeSessionDate.textContent   = new Date().toLocaleDateString('en-NG', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  DOM.activeStartTime.textContent     = formatTime(new Date(now));
  DOM.activePIN.textContent           = STATE.session.pin;
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
  DOM.statSession.textContent         = course;
  DOM.geoStatusDisplay.innerHTML      = settings.geo
    ? `<span class="dot green-dot"></span> Active (${geoR}m)`
    : `<span class="dot" style="background:var(--text-muted)"></span> Disabled`;

  const checks = ['QR'];
  if (settings.device)    checks.push('Device');
  if (settings.spotCheck) checks.push('Spot Checks');
  if (settings.geo)       checks.push('Geo');
  if (settings.ble)       checks.push('BLE');
  if (settings.selfie)    checks.push('Selfie');
  DOM.activeChecksDisplay.innerHTML = `<div class="checks-list">${checks.map(c => `<span class="check-chip">${c}</span>`).join('')}</div>`;
  DOM.spotCheckPanel.classList.toggle('hidden', !settings.spotCheck);
  if (settings.ble) { DOM.bleBeaconBtn.style.display = ''; DOM.bleBeaconBtn.onclick = toggleBLEBeacon; }

  // Write session to Sheets
  pushToSheets('writeSession', {
    sessionId: STATE.session.id, date: todayKey(), course,
    lecturer: STATE.user.name, lecturerEmail: STATE.user.googleEmail,
    startedAt: new Date(now).toISOString(), endsAt: new Date(STATE.session.endsAt).toISOString(),
    settings: JSON.stringify(settings),
  });

  // Start QR rotation
  genQR();
  let cd = QR_SECS;
  DOM.countdownNum.textContent = cd;
  STATE.qrInterval = setInterval(() => {
    cd--; DOM.countdownNum.textContent = cd;
    if (cd <= 0) {
      cd = QR_SECS; genQR();
      DOM.qrWrapper?.classList.add('flash');
      setTimeout(() => DOM.qrWrapper?.classList.remove('flash'), 350);
    }
  }, 1000);

  // Session timer
  tickTimer();
  STATE.sessionTimer = setInterval(() => {
    tickTimer();
    if (Date.now() >= STATE.session.endsAt) { endSession(false); toast('Session time expired', 'info'); }
  }, 1000);

  // Poll for new student check-ins from Sheets
  startAttendPoll();

  saveState();
  toast('Session started — QR is live!', 'success');
}

async function genQR() {
  if (!STATE.session) return;
  const token  = generateId(20);
  const expiry = Date.now() + QR_SECS * 1000 + 3000; // 3s grace
  STATE.session.qrToken  = token;
  STATE.session.qrExpiry = expiry;

  const s = STATE.session;
  const payload = JSON.stringify({
    sid: s.id, tok: token, exp: expiry,
    crs: s.course, pin: s.pin, date: s.date,
    lat: s.lat, lng: s.lng,
    geo: s.settings.geo, rad: s.settings.geoRadius,
    dev: s.settings.device, slf: s.settings.selfie,
    ble: s.settings.ble, v: APP_VER,
    gas: gasGetUrl() || '',  // ← KEY: students write here
  });

  DOM.qrSessionCode.textContent = s.id.slice(0, 8).toUpperCase();
  try {
    new QRious({ element: DOM.qrCanvas, value: payload, size: 220, level: 'H', background: '#ffffff', foreground: '#0d1630', padding: 12 });
  } catch(e) { console.error('QR error', e); }

  // Push to Sheets so students polling for live token get it
  pushToSheets('pushQRToken', {
    sessionId: s.id, token, expiry, course: s.course,
    lat: s.lat ?? '', lng: s.lng ?? '',
    geo: s.settings.geo, geoRadius: s.settings.geoRadius,
    device: s.settings.device, selfie: s.settings.selfie,
    ble: s.settings.ble, pin: s.pin, date: s.date,
  });

  saveState();
}

function tickTimer() {
  if (!STATE.session) return;
  const rem = STATE.session.endsAt - Date.now();
  if (rem <= 0) { DOM.activeTimeLeft.textContent = 'Ended'; return; }
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  DOM.activeTimeLeft.textContent = `${m}m ${s.toString().padStart(2,'0')}s`;
}

async function endSession(silent) {
  clearInterval(STATE.qrInterval);
  clearInterval(STATE.sessionTimer);
  STATE.qrInterval = STATE.sessionTimer = null;
  sheetsStopAttendancePoll();
  if (STATE.session) pushToSheets('updateSessionStatus', { sessionId: STATE.session.id });
  bleStopBeacon();
  DOM.bleBeaconBtn.style.display      = 'none';
  STATE.bleBeaconActive               = false;
  STATE.session                       = null;
  DOM.startSessionArea.style.display  = '';
  DOM.activeSessionArea.style.display = 'none';
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot inactive"></span> Inactive';
  DOM.statSession.textContent         = '—';
  DOM.spotCheckPanel.classList.add('hidden');
  if (!silent) toast('Session ended and archived in Sheets', 'info');
  saveState();
}

// ─── Lecturer attendance poll ─────────────────────
function startAttendPoll() {
  if (!gasIsReady() || !STATE.session) return;
  sheetsStartAttendancePoll(STATE.session.id, row => {
    const ts = row.checkInISO ? new Date(row.checkInISO).getTime() : Date.now();
    const rec = {
      name: row.studentName, googleEmail: row.googleEmail || '',
      matric: row.matric, course: row.course,
      timestamp: ts, date: row.date,
      distance: row.distance ? Number(row.distance) : null,
      deviceId: row.deviceId, sessionId: STATE.session?.id || '',
      bleVerified: row.bleVerified || false,
      flagged: false, spotChecked: false, spotResult: null,
    };
    if (addRecord(rec)) toast(`${row.studentName} checked in`, 'success');
  });
}

// ─── Student QR token poll ────────────────────────
function startSheetsPoll() {
  if (!gasIsReady()) return;
  DOM.sheetsPollingBar?.classList.remove('hidden');
  sheetsStartPolling(data => {
    STATE.liveSheetToken = data;
    if (DOM.scanSubtitle) DOM.scanSubtitle.textContent = 'Live session found — scan or enter code below';
  });
}

// ═══════════════════════════════════════════════════
//  BLE BEACON  (Lecturer)
// ═══════════════════════════════════════════════════
async function toggleBLEBeacon() {
  if (STATE.bleBeaconActive) {
    bleStopBeacon();
    STATE.bleBeaconActive = false;
    DOM.bleBeaconBtn.classList.remove('active');
    DOM.bleBeaconText.textContent = 'Activate BLE Beacon';
    return;
  }
  if (!bleIsSupported()) { toast('Bluetooth not supported on this device', 'error'); return; }
  const r = await bleStartBeacon(STATE.session.id);
  if (r.success) {
    STATE.bleBeaconActive = true;
    DOM.bleBeaconBtn.classList.add('active');
    DOM.bleBeaconText.textContent = `Beacon Active — ${r.deviceName}`;
    toast('BLE beacon active', 'success');
  } else {
    toast(`BLE: ${r.reason}`, 'error');
  }
}

// ═══════════════════════════════════════════════════
//  SPOT CHECKS
// ═══════════════════════════════════════════════════
function triggerSpotCheck() {
  if (!STATE.attendance.length) { toast('No attendees yet', 'error'); return; }
  const eligible = STATE.attendance.filter(r => !r.spotChecked);
  const count    = Math.max(1, Math.ceil(eligible.length * SPOT_PCT));
  const selected = shuffle([...eligible]).slice(0, count);
  if (!selected.length) { toast('All students already checked', 'info'); return; }

  DOM.spotCheckList.innerHTML = selected.map(r => `
    <div class="spot-check-item" id="sc_${r.matric}">
      <div class="spot-check-student">
        <strong>${esc(r.name)}</strong>
        <span>${esc(r.matric)}</span>
      </div>
      <div class="spot-check-actions">
        <button class="btn-spot-present" onclick="resolveSpot('${r.matric}',true)">✓ Present</button>
        <button class="btn-spot-absent"  onclick="resolveSpot('${r.matric}',false)">✗ Absent</button>
      </div>
    </div>`).join('');

  if (bc) bc.postMessage({ type: 'spot_check', matricList: selected.map(r => r.matric) });
  toast(`Spot checking ${selected.length} student${selected.length > 1 ? 's' : ''}`, 'info');
}

window.resolveSpot = function(matric, present) {
  const r = STATE.attendance.find(x => x.matric === matric);
  if (r) { r.spotChecked = true; r.spotResult = present ? 'confirmed' : 'absent'; if (!present) r.flagged = true; }
  const el = $(`sc_${matric}`);
  if (el) el.querySelector('.spot-check-actions').innerHTML =
    `<span class="spot-result-chip ${present ? 'confirmed' : 'absent'}">${present ? '✓ Confirmed' : '✗ Absent'}</span>`;
  renderTable(); updateStats(); saveState();
  if (STATE.session) pushToSheets('updateSpotCheck', { sessionId: STATE.session.id, matric, result: present ? 'confirmed' : 'absent' });
};

// ═══════════════════════════════════════════════════
//  ATTENDANCE TABLE
// ═══════════════════════════════════════════════════
function addRecord(rec) {
  // Dedup by deviceId+sessionId OR matric+sessionId
  const dup = STATE.attendance.find(r =>
    r.sessionId === rec.sessionId && (r.deviceId === rec.deviceId || r.matric === rec.matric));
  if (dup) return false;
  STATE.attendance.push(rec);
  renderTable(); updateStats(); saveState();
  return true;
}

function renderTable() {
  if (!STATE.attendance.length) {
    DOM.attendanceBody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>No check-ins yet</p></div></td></tr>`;
    return;
  }
  DOM.attendanceBody.innerHTML = STATE.attendance.map((r, i) => {
    const chip = r.spotResult === 'absent'    ? `<span class="status-chip suspicious">✗ Absent</span>`
               : r.flagged                    ? `<span class="status-chip suspicious">⚠ Flagged</span>`
               : r.spotResult === 'confirmed' ? `<span class="status-chip present">✓ Verified</span>`
               :                               `<span class="status-chip present">✓ Present</span>`;
    const ble  = r.bleVerified ? '<span style="color:var(--success)">✓</span>' : '—';
    const date = r.date || (r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-NG') : '—');
    const time = r.timestamp ? formatTime(new Date(r.timestamp)) : '—';
    return `<tr>
      <td>${i+1}</td>
      <td>${esc(r.name)}</td>
      <td style="font-size:.75rem;color:var(--text-muted)">${esc(r.googleEmail||'—')}</td>
      <td>${esc(r.matric||'—')}</td>
      <td><span class="date-badge">${date}</span></td>
      <td>${time}</td>
      <td>${r.distance != null ? r.distance+'m' : '—'}</td>
      <td>${ble}</td>
      <td>${chip}</td>
    </tr>`;
  }).join('');
}

function updateStats() {
  const total   = STATE.attendance.length;
  const flagged = STATE.attendance.filter(r => r.flagged || r.spotResult === 'absent').length;
  DOM.statTotal.textContent   = total;
  DOM.statRate.textContent    = total ? `${total} in` : '—';
  DOM.statFlagged.textContent = flagged;
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════
function exportExcel() {
  if (!STATE.attendance.length) { toast('No records to export', 'error'); return; }
  const course  = STATE.session?.course || STATE.attendance[0]?.course || 'Course';
  const dateStr = new Date().toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
  const wb      = XLSX.utils.book_new();
  const ws      = XLSX.utils.aoa_to_sheet([
    [`SCHOOLER Attendance — ${course} — ${dateStr}`], [],
    ['#','Name','Email','Matric','Date','Time','Distance','BLE','Status','Spot Check'],
    ...STATE.attendance.map((r,i) => [
      i+1, r.name, r.googleEmail||'', r.matric||'',
      r.date||'', r.timestamp ? formatTime(new Date(r.timestamp)) : '',
      r.distance != null ? `${r.distance}m` : '', r.bleVerified ? 'Yes' : 'No',
      r.spotResult === 'absent' ? 'Absent' : r.flagged ? 'Flagged' : 'Present',
      r.spotResult || 'Not checked',
    ]),
    [], ['Summary'],
    ['Total', STATE.attendance.length],
    ['Flagged', STATE.attendance.filter(r=>r.flagged).length],
    ['Generated', new Date().toLocaleString('en-NG')],
  ]);
  ws['!cols'] = [{wch:4},{wch:22},{wch:26},{wch:18},{wch:12},{wch:12},{wch:10},{wch:6},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `SCHOOLER_${course.replace(/\s/g,'_')}_${Date.now()}.xlsx`);
  toast('Excel downloaded!', 'success');
}

// ═══════════════════════════════════════════════════
//  QR SCANNER  (Student)
// ═══════════════════════════════════════════════════
async function startScanner() {
  if (STATE.scanActive) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    STATE.scanStream  = stream;
    STATE.scanActive  = true;
    DOM.scannerVideo.srcObject = stream;
    DOM.scannerVideo.play();
    DOM.startScanBtn.style.display = 'none';
    DOM.scanHint.textContent = 'Point at QR code…';
    requestAnimationFrame(scanFrame);
  } catch(e) {
    toast('Camera access denied — use manual code below', 'error');
  }
}

function scanFrame() {
  if (!STATE.scanActive) return;
  const v = DOM.scannerVideo;
  if (v.readyState !== v.HAVE_ENOUGH_DATA) { STATE.scanAnimFrame = requestAnimationFrame(scanFrame); return; }
  const c = DOM.scannerCanvas, ctx = c.getContext('2d');
  c.width = v.videoWidth; c.height = v.videoHeight;
  ctx.drawImage(v, 0, 0);
  const img  = ctx.getImageData(0, 0, c.width, c.height);
  const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (code) { stopScanner(); handleQR(code.data); return; }
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

// ─── Process QR payload ───────────────────────────
async function handleQR(raw) {
  let p;
  try { p = JSON.parse(raw); } catch(e) { showErr('Invalid QR', 'Not a SCHOOLER QR code.'); return; }
  if (!p.sid || !p.tok || !p.exp) { showErr('Invalid QR', 'QR data is incomplete.'); return; }

  // Expiry
  if (Date.now() > p.exp) { showErr('QR Expired', 'This code expired — they refresh every 10s. Wait for the next one.'); return; }

  // Date
  if (p.date && p.date !== todayKey()) { showErr('Wrong Day', `This QR is from ${p.date}. Today's sessions only.`); return; }

  // ── DEVICE DUPLICATE CHECK — instant, local, before any network call
  if (hasDeviceSeen(STATE.user?.matric || '', p.sid)) {
    showInfo('Already Recorded',
      'This device already submitted attendance for this session. Each student needs their own device. Your first scan was recorded.',
      p.crs);
    return;
  }

  // ── Extract Apps Script URL from QR so student can submit directly
  if (p.gas) gasSetUrl(p.gas);
  const canSync = gasIsReady();

  // ── BLE check (optional)
  let bleVerified = false;
  if (p.ble) {
    toast('Checking BLE proximity…', 'info');
    const r = await bleScanForBeacon(p.sid);
    if (!r.verified && !r.fallback) { showErr('BLE Check Failed', r.reason); return; }
    bleVerified = r.verified;
    if (!r.verified) toast('BLE unavailable — continuing with QR', 'info');
  }

  // ── Geo check (optional)
  let distRounded = null;
  if (p.geo && p.lat && p.lng) {
    toast('Verifying location…', 'info');
    let coords;
    try { coords = await getGeo(); }
    catch(e) { showErr('Location Required', 'Enable location services to mark attendance.'); return; }
    if (coords.accuracy > 150) { showErr('Weak GPS', `Accuracy is ${Math.round(coords.accuracy)}m. Move closer to a window.`); return; }
    const dist = haversine(coords.latitude, coords.longitude, p.lat, p.lng);
    distRounded = Math.round(dist);
    if (dist > (p.rad || 50)) { showErr('Too Far Away', `You are ${distRounded}m away. Must be within ${p.rad||50}m.`); return; }
  }

  // ── Selfie (optional)
  if (p.slf) { try { await captureSelfie(); } catch(e) { toast('Selfie skipped', 'info'); } }

  // ── Mark device seen BEFORE any network call (prevent double-tap race)
  markDeviceSeen(STATE.user?.matric || '', p.sid);

  // ── Build record
  const rec = {
    name:        STATE.user.name,
    googleEmail: STATE.user.googleEmail || '',
    matric:      STATE.user.matric || '',
    course:      p.crs,
    timestamp:   Date.now(),
    date:        todayKey(),
    distance:    distRounded,
    sessionId:   p.sid,
    deviceId:    STATE.deviceId,
    bleVerified,
    flagged: false, spotChecked: false, spotResult: null,
  };

  // ── Submit to lecturer's Apps Script
  let queued = false;
  if (!STATE.isOnline || !canSync) {
    STATE.offlineQueue.push(rec);
    queued = true;
    refreshOfflineUI();
  } else {
    try {
      const result = await gasSubmitAttendance(rec);
      if (result?.duplicate) {
        showInfo('Already Recorded', 'Sheets confirmed this device is already recorded. Your first scan counted.', p.crs);
        return;
      }
    } catch(e) {
      STATE.offlineQueue.push(rec);
      queued = true;
      refreshOfflineUI();
    }
    // Broadcast for same-device testing
    if (bc) bc.postMessage({ type: 'attendance', record: rec });
    localStorage.setItem('sch_checkin', JSON.stringify({ record: rec, ts: Date.now() }));
  }

  rec.offlineQueued = queued;

  STATE.studentHistory.unshift({
    course: p.crs, date: todayKey(), timestamp: rec.timestamp,
    status: queued ? 'offline' : 'present', bleVerified,
  });
  renderHistory();
  saveState();
  showSuccess(rec, distRounded, bleVerified, queued);
}

function handleManualCode() {
  const raw = DOM.manualCode.value.trim();
  if (!raw) { toast('Enter a session code or PIN', 'error'); return; }

  // Try liveSheetToken (when student already has GAS URL via polling)
  if (STATE.liveSheetToken) {
    const t = STATE.liveSheetToken;
    if (raw.toUpperCase() === t.sessionId?.slice(0,8).toUpperCase() ||
        raw.toUpperCase() === (t.pin||'').toUpperCase()) {
      handleQR(JSON.stringify({
        sid: t.sessionId, tok: t.token, exp: t.expiry,
        crs: t.course, pin: t.pin, date: t.date || todayKey(),
        lat: t.lat, lng: t.lng, geo: t.geo, rad: t.geoRadius,
        dev: t.device, slf: t.selfie, ble: t.ble, v: APP_VER,
        gas: gasGetUrl() || '',
      }));
      return;
    }
  }

  // Same-device relay (testing)
  const relay = localStorage.getItem('schooler_session');
  if (relay) {
    try {
      const s = JSON.parse(relay);
      if (s.id.slice(0,8).toUpperCase() === raw.toUpperCase() || s.pin === raw.toUpperCase()) {
        handleQR(JSON.stringify({
          sid: s.id, tok: s.qrToken, exp: s.qrExpiry,
          crs: s.course, pin: s.pin, date: s.date || todayKey(),
          lat: s.lat, lng: s.lng,
          geo: s.settings?.geo??false, rad: s.settings?.geoRadius??50,
          dev: s.settings?.device??true, slf: s.settings?.selfie??false,
          ble: s.settings?.ble??false, v: APP_VER,
          gas: gasGetUrl() || '',
        }));
        return;
      }
    } catch(e) {}
  }

  toast('Code not found. On a separate device, you must scan the QR — the QR carries the connection info.', 'error');
}

// ─── Student status display ───────────────────────
function showSuccess(rec, dist, ble, queued) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className = 'status-icon success';
  DOM.statusIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  DOM.statusTitle.textContent = queued ? 'Saved Locally!' : 'Attendance Marked!';
  DOM.statusMsg.textContent   = queued
    ? 'Saved locally — will sync when internet returns.'
    : 'Recorded in Google Sheets ✓';
  DOM.statusMeta.innerHTML = `
    <span>📚 ${esc(rec.course)}</span>
    <span>📅 ${rec.date}</span>
    <span>⏱ ${formatTime(new Date(rec.timestamp))}</span>
    ${dist != null ? `<span>📍 ${dist}m from classroom</span>` : ''}
    <span>👤 ${esc(rec.name)} · ${esc(rec.googleEmail)}</span>
    <span>📱 Device: ${deviceShort()}</span>
    ${ble ? '<span>📶 BLE proximity verified</span>' : ''}`;
  toast(queued ? 'Saved offline' : 'Attendance recorded!', 'success');
}

function showErr(title, msg) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className = 'status-icon error';
  DOM.statusIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  DOM.statusTitle.textContent = title;
  DOM.statusMsg.textContent   = msg;
  DOM.statusMeta.innerHTML    = '';
  toast(title, 'error');
}

function showInfo(title, msg, course) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');
  DOM.statusIcon.className = 'status-icon';
  DOM.statusIcon.style.cssText = 'background:rgba(26,108,255,.12);color:var(--accent-blue-bright)';
  DOM.statusIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  DOM.statusTitle.textContent = title;
  DOM.statusMsg.textContent   = msg;
  DOM.statusMeta.innerHTML    = course ? `<span>📚 ${esc(course)}</span>` : '';
}

function resetScan() {
  DOM.statusCard.classList.add('hidden');
  DOM.statusIcon.style.cssText = '';
  DOM.scanCard.classList.remove('hidden');
  DOM.manualCode.value = '';
}

// ─── Selfie ───────────────────────────────────────
function captureSelfie() {
  return new Promise(async (resolve, reject) => {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); }
    catch(e) { reject(e); return; }
    STATE.selfieStream        = stream;
    DOM.selfieVideo.srcObject = stream;
    DOM.selfieVideo.play();
    DOM.selfieModal.classList.remove('hidden');
    DOM.selfieCaptureBtn.onclick = () => {
      const c = DOM.selfieCanvas;
      c.width = DOM.selfieVideo.videoWidth; c.height = DOM.selfieVideo.videoHeight;
      c.getContext('2d').drawImage(DOM.selfieVideo, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      STATE.selfieStream = null;
      DOM.selfieModal.classList.add('hidden');
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    DOM.selfieCancelBtn.onclick = () => {
      stream.getTracks().forEach(t => t.stop());
      STATE.selfieStream = null;
      DOM.selfieModal.classList.add('hidden');
      reject(new Error('cancelled'));
    };
  });
}

// ─── Student history ──────────────────────────────
function renderHistory() {
  if (!STATE.studentHistory.length) return;
  const present = STATE.studentHistory.filter(h => h.status !== 'absent').length;
  DOM.historyRate.textContent = `${Math.round((present / STATE.studentHistory.length) * 100)}% attendance`;
  DOM.historyList.innerHTML   = STATE.studentHistory.map(h => `
    <div class="history-item">
      <div>
        <div class="history-course">${esc(h.course)}</div>
        <div class="history-time">${h.date || ''} ${h.timestamp ? formatTime(new Date(h.timestamp)) : ''} ${h.bleVerified ? '· 📶' : ''}</div>
      </div>
      <span class="history-status ${h.status}">${h.status === 'offline' ? '⏳ Pending' : '✓ Present'}</span>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════
//  BROADCAST / LOCAL RELAY
// ═══════════════════════════════════════════════════
let bc;
try { bc = new BroadcastChannel('schooler_attendance'); } catch(e) { bc = null; }
if (bc) {
  bc.onmessage = ev => {
    if (ev.data?.type === 'attendance' && STATE.role === 'lecturer' && STATE.session) {
      if (ev.data.record.sessionId === STATE.session.id) {
        if (addRecord(ev.data.record)) toast(`${ev.data.record.name} checked in`, 'success');
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

// LocalStorage relay poll (same device / same tab testing)
setInterval(() => {
  if (STATE.role !== 'lecturer' || !STATE.session) return;
  const raw = localStorage.getItem('sch_checkin');
  if (!raw) return;
  try {
    const { record, ts } = JSON.parse(raw);
    if (Date.now() - ts > 20000) return;
    if (record.sessionId === STATE.session.id) {
      if (addRecord(record)) { toast(`${record.name} checked in`, 'success'); localStorage.removeItem('sch_checkin'); }
    }
  } catch(e) {}
}, 1500);

// ═══════════════════════════════════════════════════
//  GEO / HAVERSINE
// ═══════════════════════════════════════════════════
function getGeo() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('Not supported')); return; }
    navigator.geolocation.getCurrentPosition(p => res(p.coords), rej,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
const rad = d => d * Math.PI / 180;

// ═══════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      role: STATE.role, user: STATE.user,
      session: STATE.session, attendance: STATE.attendance,
      studentHistory: STATE.studentHistory, offlineQueue: STATE.offlineQueue,
    }));
    if (STATE.session) localStorage.setItem('schooler_session', JSON.stringify(STATE.session));
    else               localStorage.removeItem('schooler_session');
  } catch(e) {}
}
function loadState() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function clearState() {
  [STORE_KEY, 'schooler_session', 'sch_checkin'].forEach(k => localStorage.removeItem(k));
}

function restoreSession(saved) {
  STATE.role           = saved.role;
  STATE.user           = saved.user;
  STATE.attendance     = saved.attendance     || [];
  STATE.studentHistory = saved.studentHistory || [];
  STATE.offlineQueue   = saved.offlineQueue   || [];

  if (gasGetUrl()) STATE.sheetsReady = true;
  updateSheetsUI();

  if (STATE.user) setNavUser(STATE.role === 'lecturer' ? 'lecturer' : 'student', STATE.user.name, STATE.user.picture || '');

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = STATE.user?.course || '';
    // Pre-fill GAS URL
    const savedUrl = gasGetUrl();
    if (savedUrl) { DOM.gasUrlInput.value = savedUrl; DOM.gasUrlNote.style.display = ''; }
    renderTable(); updateStats();
    showScreen('lecturer');

    if (saved.session && saved.session.endsAt > Date.now() && saved.session.date === todayKey()) {
      STATE.session = saved.session;
      DOM.startSessionArea.style.display  = 'none';
      DOM.activeSessionArea.style.display = '';
      DOM.activeCourseName.textContent    = STATE.session.course;
      DOM.activeSessionDate.textContent   = new Date().toLocaleDateString('en-NG', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
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

      genQR();
      let cd = QR_SECS; DOM.countdownNum.textContent = cd;
      STATE.qrInterval = setInterval(() => {
        cd--; DOM.countdownNum.textContent = cd;
        if (cd <= 0) { cd = QR_SECS; genQR(); DOM.qrWrapper?.classList.add('flash'); setTimeout(() => DOM.qrWrapper?.classList.remove('flash'), 350); }
      }, 1000);
      tickTimer();
      STATE.sessionTimer = setInterval(() => {
        tickTimer();
        if (Date.now() >= STATE.session.endsAt) { endSession(false); toast('Session expired', 'info'); }
      }, 1000);
      startAttendPoll();
      toast(`Session restored — ${STATE.session.course}`, 'info');
    } else if (saved.session && saved.session.date !== todayKey()) {
      toast('Previous session archived. Start a new one for today.', 'info');
    }
  } else if (STATE.role === 'student') {
    DOM.studentName.textContent          = STATE.user.name;
    DOM.studentMatricDisplay.textContent = STATE.user.matric ? `${STATE.user.matric} · ${STATE.user.course}` : STATE.user.course;
    DOM.deviceChip.title                 = `Device: ${deviceShort()}`;
    setHeroAvatar(STATE.user.picture || '');
    renderHistory();
    if (STATE.sheetsReady) startSheetsPoll();
    showScreen('student');
    refreshOfflineUI();
    syncQueue();
    toast(`Welcome back, ${STATE.user.name.split(' ')[0]}`, 'info');
  } else {
    showScreen('auth');
  }
}

// ═══════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════
let toastTimer;
function toast(msg, type = 'info') {
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
  const close = () => DOM.modal.classList.add('hidden');
  DOM.modalConfirm.onclick = () => { close(); onConfirm(); };
  DOM.modalCancel.onclick  = close;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function generateId(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr   = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function generatePIN() {
  const n = new Uint8Array(3), l = new Uint8Array(3);
  crypto.getRandomValues(n); crypto.getRandomValues(l);
  return Array.from(n, b => b%10).join('') + '-' + Array.from(l, b => String.fromCharCode(65+b%26)).join('');
}

function shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

// ═══════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(r => console.log('[SCHOOLER] SW registered', r.scope))
      .catch(e => console.warn('[SCHOOLER] SW failed:', e));
  });
}
