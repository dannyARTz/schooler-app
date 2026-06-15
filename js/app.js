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
  googleProfile: null,   // { name, email, picture } from Google ID token
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
  sheetsReady: false,    // true once OAuth token + sheet ID are both set
  lastSheetsPush: null,
  bleBeaconActive: false,
  liveSheetToken: null,
};

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const QR_REFRESH_SECS = 10;
const APP_VERSION     = '1.3.0';
const STORAGE_KEY     = 'schooler_state_v3';
const SPOT_CHECK_PCT  = 0.05;

// ═══════════════════════════════════════════════════════
//  DOM  — populated after DOMContentLoaded
// ═══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
let DOM = {};   // filled by initDOM() once the page is ready

function initDOM() {
  DOM = {
    splash:               $('splash'),
    // SSO screens
    authScreen:           $('authScreen'),
    completionScreen:     $('completionScreen'),
    googleSignInBtn:      $('googleSignInBtn'),
    ssoFallbackBtn:       $('ssoFallbackBtn'),
    ssoError:             $('ssoError'),
    ssoErrorText:         $('ssoErrorText'),
    ssoHint:              $('ssoHint'),
    completionAvatar:     $('completionAvatar'),
    completionName:       $('completionName'),
    completionEmail:      $('completionEmail'),
    completionSubtitle:   $('completionSubtitle'),
    completionForm:       $('completionForm'),
    deviceWarning:        $('deviceWarning'),
    roleTabs:             document.querySelectorAll('.role-tab'),
    // Hidden compat inputs (auto-filled from Google profile)
    authName:             $('authName'),
    authMatric:           $('authMatric'),
    authCourse:           $('authCourse'),
    authDept:             $('authDept'),
    authBtn:              $('authBtn'),
    matricGroup:          $('matricGroup'),
    courseGroup:          $('courseGroup'),
    // Sheets sync badge
    sheetsSyncBadge:      $('sheetsSyncBadge'),
    sheetsSyncText:       $('sheetsSyncText'),
    sheetsSyncStatus:     $('sheetsSyncStatus'),
    sheetsPollingBar:     $('sheetsPollingBar'),
    // Dashboards
    lecturerDash:         $('lecturerDashboard'),
    studentDash:          $('studentDashboard'),
    // Navbar avatars
    lecturerUserPill:     $('lecturerUserPill'),
    lecturerAvatar:       $('lecturerAvatar'),
    lecturerDisplayName:  $('lecturerDisplayName'),
    studentUserPill:      $('studentUserPill'),
    studentNavAvatar:     $('studentNavAvatar'),
    studentNavName:       $('studentNavName'),
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
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initDOM();          // ← must be first — populates all DOM refs
  loadTheme();
  initDeviceId();
  initNetworkListeners();
  initEventListeners(); // ← wire all buttons/inputs now that DOM exists
  setTimeout(bootApp, 1900);
});

function bootApp() {
  DOM.splash.classList.add('fade-out');
  setTimeout(() => {
    DOM.splash.style.display = 'none';
    const saved = loadSavedState();
    if (saved && saved.googleProfile) {
      STATE.googleProfile = saved.googleProfile;
      restoreSession(saved);
    } else {
      showScreen('auth');
      initGoogleSSO();
    }
  }, 400);
}

// ═══════════════════════════════════════════════════════
//  EVENT LISTENERS — all wired here after DOM is ready
// ═══════════════════════════════════════════════════════
function initEventListeners() {
  // Theme
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.themeToggleStudent.addEventListener('click', toggleTheme);

  // Settings panel
  initSettingsListeners();

  // SSO role tabs
  DOM.roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedRole = tab.dataset.role;
      DOM.deviceWarning.classList.add('hidden');
      DOM.ssoHint.innerHTML = selectedRole === 'lecturer'
        ? 'Your Google account auto-creates your attendance sheet. No setup needed.'
        : 'Signing in with Google verifies your identity. Each student needs their own Google account.';
    });
  });

  // Completion form & fallback
  DOM.authBtn.addEventListener('click', handleAuth);
  DOM.ssoFallbackBtn.addEventListener('click', () => {
    STATE.googleProfile = { name: 'Local User', email: 'local@schooler.app', picture: '', sub: generateId(16) };
    STATE.sheetsReady   = false;
    DOM.authName.value  = 'Local User';
    handlePostGoogle();
    showToast('Running in local-only mode. Attendance will not sync to Sheets.', 'info');
  });

  // Logouts
  DOM.lecturerLogout.addEventListener('click', () => {
    confirmModal('Sign out?', 'This will end any active session and sign you out of Google.', () => {
      endSession(true); bleStopBeacon(); googleSignOut();
    });
  });
  DOM.studentLogout.addEventListener('click', () => {
    stopScanner(); sheetsStopPolling(); googleSignOut();
  });

  // Session
  DOM.startSessionBtn.addEventListener('click', startSession);
  DOM.endSessionBtn.addEventListener('click', () => {
    confirmModal('End Session?', 'Students can no longer check in. Records stay in Sheets.', () => endSession(false));
  });

  // Spot check
  DOM.triggerSpotCheckBtn.addEventListener('click', triggerSpotCheck);

  // Attendance table
  DOM.clearAttendanceBtn.addEventListener('click', () => {
    confirmModal('Clear Log?', 'Removes records from this view. Sheets data is not deleted.', () => {
      STATE.attendance = []; renderAttendanceTable(); updateStats(); saveStateSnapshot();
    });
  });
  DOM.exportBtn.addEventListener('click', exportExcel);

  // Scanner
  DOM.startScanBtn.addEventListener('click', startScanner);
  DOM.scanAgainBtn.addEventListener('click', resetStudentScan);
  DOM.manualSubmitBtn.addEventListener('click', handleManualCode);

  // Modal close
  DOM.modalCancel.addEventListener('click', () => DOM.modal.classList.add('hidden'));
}

// ═══════════════════════════════════════════════════════
//  GOOGLE SSO  — single OAuth2 prompt, no double verify
// ═══════════════════════════════════════════════════════

let selectedRole = 'lecturer';

function initGoogleSSO() {
  const clientId = window.SCHOOLER_CLIENT_ID;

  if (typeof google === 'undefined' || !google.accounts) {
    DOM.ssoFallbackBtn.style.display = '';
    DOM.googleSignInBtn.innerHTML = `<div class="sso-loading">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Google Sign-In unavailable — use fallback below</div>`;
    return;
  }

  if (!clientId || clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
    renderDevModeSignIn(); return;
  }

  // ── SINGLE FLOW: token client only ──────────────
  // We request an OAuth2 access token. From that token we call
  // the userinfo endpoint to get name/email/picture.
  // No separate google.accounts.id flow — zero double prompts.
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'openid', 'email', 'profile',
    ].join(' '),
    callback: handleOAuthToken,
    error_callback: (err) => showSSOError(`Sign-in error: ${err.type || err}`),
  });

  window._schoolerTokenClient = tokenClient;

  // Render a single styled button that triggers the token flow
  DOM.googleSignInBtn.innerHTML = `
    <button class="google-oauth-btn" id="googleOAuthBtn">
      <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      Continue with Google
    </button>`;

  document.getElementById('googleOAuthBtn').addEventListener('click', () => {
    // prompt:'select_account' lets the user pick which Google account
    // without showing a second consent screen after the first sign-in
    window._schoolerTokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

// Called once — with access token in hand
async function handleOAuthToken(tokenResponse) {
  if (tokenResponse.error) {
    showSSOError(`Authorisation failed: ${tokenResponse.error_description || tokenResponse.error}`);
    return;
  }

  const token = tokenResponse.access_token;
  sheetsSetToken(token);

  // Fetch profile from Google userinfo (uses same token — no second prompt)
  let profile;
  try {
    profile = await sheetsFetchUserInfo(token);
  } catch(e) {
    showSSOError('Could not read your Google profile. Please try again.');
    return;
  }

  STATE.googleProfile = {
    name:    profile.name,
    email:   profile.email,
    picture: profile.picture,
    sub:     profile.sub,
  };
  sheetsSetEmail(profile.email);

  // Lecturer: bootstrap their sheet immediately
  if (selectedRole === 'lecturer') {
    showToast('Connecting to your attendance sheet…', 'info');
    try {
      const result = await sheetsBootstrap(profile.email);
      STATE.sheetsReady = true;
      showToast(result.isNew ? 'Attendance sheet created in your Drive ✓' : 'Connected to your SCHOOLER sheet ✓', 'success');
    } catch(e) {
      showToast(`Sheet setup failed: ${e.message} — running offline`, 'info');
    }
  } else {
    // Students: token stored, sheet ID will come from QR payload
    STATE.sheetsReady = true;
  }

  handlePostGoogle();
}

// After Google auth is complete — show completion screen or go straight to dashboard
function handlePostGoogle() {
  // Show completion screen for profile confirmation + student extra fields
  DOM.authScreen.classList.add('hidden');
  DOM.completionScreen.classList.remove('hidden');

  // Populate completion screen with Google profile
  const p = STATE.googleProfile;
  if (p) {
    DOM.completionAvatar.src   = p.picture || '';
    DOM.completionName.textContent  = p.name  || '';
    DOM.completionEmail.textContent = p.email || '';
    // Pre-fill hidden name field
    DOM.authName.value = p.name || '';
  }

  if (selectedRole === 'lecturer') {
    // Lecturers don't need extra fields — just confirm and go
    DOM.completionSubtitle.textContent = 'Signed in as Lecturer. Click below to open your dashboard.';
    DOM.matricGroup.style.display  = 'none';
    DOM.courseGroup.style.display  = 'none';
    DOM.authBtn.textContent        = 'Open Lecturer Dashboard';
  } else {
    // Students need matric + course
    DOM.completionSubtitle.textContent = 'Almost there — enter your details to mark attendance.';
    DOM.matricGroup.style.display  = '';
    DOM.courseGroup.style.display  = '';
    DOM.authBtn.textContent        = 'Enter SCHOOLER';
    // Check device binding warning
    DOM.authMatric.addEventListener('blur', () => {
      const matric = DOM.authMatric.value.trim();
      if (!matric) return;
      const check = checkDeviceBinding(matric);
      DOM.deviceWarning.classList.toggle('hidden', check.bound !== false);
    });
  }
}

function showSSOError(msg) {
  DOM.ssoErrorText.textContent = msg;
  DOM.ssoError.classList.remove('hidden');
}

function handleAuth() {
  const name   = (DOM.authName.value || STATE.googleProfile?.name || '').trim();
  const matric = DOM.authMatric.value.trim();
  const course = DOM.authCourse.value.trim();
  const email  = STATE.googleProfile?.email || '';

  if (!name) { showToast('Could not read your name from Google', 'error'); return; }

  if (selectedRole === 'student') {
    if (!matric) { showToast('Please enter your matric number', 'error'); return; }
    if (!course) { showToast('Please enter your course code', 'error'); return; }
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
  STATE.user = { name, course, dept: '', matric, googleEmail: email };
  saveStateSnapshot();

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = '';
    renderAttendanceTable();
    updateStats();
    populateNavAvatar('lecturer');
    showScreen('lecturer');
    updateSheetsStatus();
    showToast(`Welcome, ${name.split(' ')[0]}`, 'success');
  } else {
    DOM.studentName.textContent          = name;
    DOM.studentMatricDisplay.textContent = matric ? `${matric} · ${course}` : course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    populateNavAvatar('student');
    renderStudentHistory();
    if (STATE.sheetsReady) startSheetsPoll();
    showScreen('student');
    syncOfflineQueue();
    showToast(`Welcome, ${name.split(' ')[0]}`, 'success');
  }
}

// ─── Dev mode (no Client ID configured) ──────────
function renderDevModeSignIn() {
  DOM.googleSignInBtn.innerHTML = `
    <div class="dev-mode-notice">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Dev mode — Google Client ID not configured
    </div>
    <div class="dev-sign-in-form">
      <input type="text"  id="devName"  placeholder="Full name" class="dev-input" />
      <input type="email" id="devEmail" placeholder="Email (optional)" class="dev-input" />
      <button class="btn-primary full-width" id="devContinueBtn">Continue as ${selectedRole}</button>
    </div>`;

  document.getElementById('devContinueBtn').addEventListener('click', () => {
    const name  = document.getElementById('devName').value.trim();
    const email = document.getElementById('devEmail').value.trim();
    if (!name) { showToast('Enter your name', 'error'); return; }
    STATE.googleProfile = { name, email: email || `${name.toLowerCase().replace(/\s/g,'.')}@dev.local`, picture: '', sub: generateId(16) };
    STATE.sheetsReady   = false; // no real token in dev mode
    DOM.authName.value  = name;
    handlePostGoogle();
  });
}

// ─── Populate navbar avatar ───────────────────────
function populateNavAvatar(role) {
  const p = STATE.googleProfile;
  if (!p) return;
  const firstName = p.name.split(' ')[0];
  if (role === 'lecturer') {
    if (DOM.lecturerAvatar)      { DOM.lecturerAvatar.src = p.picture || ''; DOM.lecturerAvatar.style.display = p.picture ? '' : 'none'; }
    if (DOM.lecturerDisplayName) DOM.lecturerDisplayName.textContent = firstName;
    if (DOM.lecturerUserPill)    DOM.lecturerUserPill.style.display  = '';
  } else {
    if (DOM.studentNavAvatar)  { DOM.studentNavAvatar.src = p.picture || ''; DOM.studentNavAvatar.style.display = p.picture ? '' : 'none'; }
    if (DOM.studentNavName)    DOM.studentNavName.textContent = firstName;
    if (DOM.studentUserPill)   DOM.studentUserPill.style.display = '';
  }
}

function googleSignOut() {
  const email = STATE.googleProfile?.email;
  if (typeof google !== 'undefined' && google.accounts?.id) {
    google.accounts.id.disableAutoSelect();
    if (email) google.accounts.id.revoke(email, () => {});
  }
  clearSavedState();
  STATE.role = null; STATE.user = null; STATE.googleProfile = null;
  STATE.sheetsReady = false;
  showScreen('auth');
  initGoogleSSO();
}

// ─── Sheets status (replaces old updateSheetsIndicator) ──
function updateSheetsStatus() {
  if (!DOM.sheetsSyncBadge) return;
  const ready = STATE.sheetsReady;
  DOM.sheetsSyncBadge.classList.toggle('synced', ready);
  if (DOM.sheetsSyncText) DOM.sheetsSyncText.textContent = ready ? '✓ Sheets' : 'Local Only';
}

function setSyncStatus(status) {
  if (!DOM.sheetsSyncBadge) return;
  DOM.sheetsSyncBadge.className = `sheets-badge ${status}`;
  const labels = { syncing:'⟳ Syncing', ok:'✓ Sheets', error:'✗ Sheets' };
  if (DOM.sheetsSyncText) DOM.sheetsSyncText.textContent = labels[status] || '✓ Sheets';
  if (DOM.sheetsSyncStatus) {
    DOM.sheetsSyncStatus.innerHTML = {
      syncing: '<span class="sync-idle">Syncing…</span>',
      ok:      `<span class="sync-ok">✓ Last sync ${formatTime(new Date())}</span>`,
      error:   '<span class="sync-err">✗ Sync failed</span>',
    }[status] || '—';
  }
}

async function pushToSheets(action, payload) {
  if (!STATE.sheetsReady) return null;
  try {
    setSyncStatus('syncing');
    const result = await sheetsRequest(action, payload);
    setSyncStatus('ok');
    return result;
  } catch(e) {
    if (e.message === 'TOKEN_EXPIRED') {
      // Try to refresh token silently
      showToast('Refreshing Google session…', 'info');
      if (window._schoolerTokenClient) {
        window._schoolerTokenClient.requestAccessToken({ prompt: '' });
      }
    }
    setSyncStatus('error');
    console.warn('[Sheets]', action, e.message);
    return null;
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
  // Try to get from multiple storage locations for persistence
  // even when localStorage is cleared
  let id = localStorage.getItem('schooler_device_id')
        || sessionStorage.getItem('schooler_device_id_bk');

  if (!id) {
    // Generate a stable fingerprint from available browser signals
    const fp = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || '',
    ].join('|');

    // Hash the fingerprint to a short ID
    let hash = 0;
    for (let i = 0; i < fp.length; i++) {
      hash = ((hash << 5) - hash) + fp.charCodeAt(i);
      hash |= 0;
    }
    const fpPart = Math.abs(hash).toString(36).toUpperCase().padStart(6,'0');
    id = generateId(16) + '_' + fpPart;
  }

  STATE.deviceId = id;
  // Store in both places — if localStorage is wiped, fingerprint helps regenerate a stable-ish ID
  localStorage.setItem('schooler_device_id', id);
  sessionStorage.setItem('schooler_device_id_bk', id);
}
function getDeviceShort() {
  // Return the fingerprint suffix for display, but use full ID for dedup
  if (!STATE.deviceId) return 'UNKNOWN';
  const parts = STATE.deviceId.split('_');
  return parts[parts.length - 1] || STATE.deviceId.slice(0, 8).toUpperCase();
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
  DOM.completionScreen.classList.add('hidden');
  DOM.lecturerDash.classList.add('hidden');
  DOM.studentDash.classList.add('hidden');
  if (name === 'auth')       DOM.authScreen.classList.remove('hidden');
  if (name === 'completion') DOM.completionScreen.classList.remove('hidden');
  if (name === 'lecturer')   DOM.lecturerDash.classList.remove('hidden');
  if (name === 'student')    DOM.studentDash.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function initSettingsListeners() {
  DOM.settingGeo.addEventListener('change', () => {
    DOM.geoRadiusField.classList.toggle('hidden', !DOM.settingGeo.checked);
  });
}

// ═══════════════════════════════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════════════════════════════
function checkDeviceWarningUI() {
  if (selectedRole !== 'student') return;
  const matric = DOM.authMatric.value.trim();
  if (!matric) return;
  const check = checkDeviceBinding(matric);
  DOM.deviceWarning.classList.toggle('hidden', check.bound !== false);
}

// ═══════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════
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
    sid:  s.id, tok: token, exp: expiry,
    crs:  s.course, pin: s.pin, date: s.date,
    lat:  s.lat, lng: s.lng,
    geo:  s.settings.geo, rad: s.settings.geoRadius,
    dev:  s.settings.device, slf: s.settings.selfie,
    ble:  s.settings.ble, v: APP_VERSION,
    shid: sheetsGetUrl() || '',  // ← spreadsheetId for student writes
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
  sheetsStopAttendancePoll();

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
// ═══════════════════════════════════════════════════════
function startSheetsAttendancePoll() {
  if (!sheetsIsReady()) return;
  sheetsStartAttendancePoll(STATE.session.id, (row) => {
    // Convert Sheets row → attendance record
    const ts = row.checkInISO ? new Date(row.checkInISO).getTime() : Date.now();
    const record = {
      name:        row.studentName,
      matric:      row.matric,
      course:      row.course,
      googleEmail: row.googleEmail || '',
      timestamp:   ts,
      date:        row.date,
      distance:    row.distance ? Number(row.distance) : null,
      deviceId:    row.deviceId,
      sessionId:   STATE.session?.id || '',
      flagged:     false, spotChecked: false, spotResult: null,
      bleVerified: row.bleVerified || false,
      source:      'sheets',
    };
    const added = addAttendanceRecord(record);
    if (added) showToast(`${row.studentName} checked in`, 'success');
  });
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
  try { payload = JSON.parse(raw); } catch(e) {
    showStudentError('Invalid QR Code', 'This QR code is not from SCHOOLER.'); return;
  }
  if (!payload.sid || !payload.tok || !payload.exp) {
    showStudentError('Invalid QR Code', 'QR data is malformed.'); return;
  }

  // ── Expiry check
  if (Date.now() > payload.exp) {
    showStudentError('QR Code Expired', 'This QR has expired — they refresh every 10 seconds. Wait for the next one.'); return;
  }

  // ── Date check
  if (payload.date && payload.date !== todayKey()) {
    showStudentError('Wrong Day', `This QR is from ${payload.date}. Today's sessions only.`); return;
  }

  // ── DEVICE DUPLICATE CHECK (local, instant — before any network call)
  //    Keyed by deviceId + sessionId so same phone can never submit twice
  //    even if cookies cleared or different Google account used
  const deviceKey = `schooler_dev_scan_${STATE.deviceId}_${payload.sid}_${todayKey()}`;
  if (localStorage.getItem(deviceKey)) {
    showStudentInfo(
      'Already Recorded',
      'This device has already submitted attendance for this session today. Each student must use their own device. Your first scan was recorded.',
      payload
    );
    return;
  }

  // ── MATRIC DUPLICATE CHECK (local)
  if (hasSeenTodayForSession(STATE.user?.matric, payload.sid)) {
    showStudentInfo(
      'Already Recorded',
      'You have already marked attendance for this session. If you used a different device earlier, your first scan was recorded.',
      payload
    );
    return;
  }

  // ── Extract spreadsheetId from QR payload so student can write to the RIGHT sheet
  if (payload.shid) {
    sheetsSetSpreadsheetId(payload.shid);
  } else if (STATE.liveSheetToken?.spreadsheetId) {
    sheetsSetSpreadsheetId(STATE.liveSheetToken.spreadsheetId);
  }
  // If still no sheet ID, we'll queue offline
  const hasSheetId = !!sheetsGetUrl();

  // ── BLE check
  let bleVerified = false;
  if (payload.ble) {
    showToast('Checking Bluetooth proximity…', 'info');
    const bleResult = await bleScanForBeacon(payload.sid);
    if (!bleResult.verified && !bleResult.fallback) {
      showStudentError('BLE Check Failed', bleResult.reason); return;
    }
    bleVerified = bleResult.verified;
    if (!bleResult.verified && bleResult.fallback) {
      showToast('Bluetooth unavailable — continuing with QR only', 'info');
    }
  }

  // ── Geo check
  let distRounded = null;
  if (payload.geo && payload.lat && payload.lng) {
    showToast('Verifying location…', 'info');
    let coords;
    try { coords = await getGeolocation(); }
    catch(e) { showStudentError('Location Required', 'Enable location services to mark attendance.'); return; }
    if (coords.accuracy > 150) {
      showStudentError('Weak GPS', `GPS accuracy is ${Math.round(coords.accuracy)}m. Move to a clearer area.`); return;
    }
    const dist = haversineDistance(coords.latitude, coords.longitude, payload.lat, payload.lng);
    distRounded = Math.round(dist);
    if (dist > (payload.rad || 50)) {
      showStudentError('Too Far Away', `You are ${distRounded}m from the classroom. Must be within ${payload.rad||50}m.`); return;
    }
  }

  // ── Build record
  const record = {
    name:        STATE.user.name,
    matric:      STATE.user.matric || '',
    googleEmail: STATE.user.googleEmail || STATE.googleProfile?.email || '',
    course:      payload.crs,
    timestamp:   Date.now(),
    date:        todayKey(),
    distance:    distRounded,
    sessionId:   payload.sid,
    deviceId:    STATE.deviceId, // full device ID for server-side dedup
    flagged:     false, spotChecked: false, spotResult: null,
    bleVerified,
  };

  // ── Selfie
  if (payload.slf) {
    try { await captureSelfie(); }
    catch(e) { showToast('Selfie skipped — attendance submitted', 'info'); }
  }

  // ── Mark seen BEFORE submitting (prevent race condition double-tap)
  localStorage.setItem(deviceKey, '1');
  if (payload.dev) markSeenTodayForSession(STATE.user.matric, payload.sid);

  // ── Submit to Sheets (or queue offline)
  let offlineQueued = false;
  if (!STATE.isOnline || !STATE.sheetsReady || !hasSheetId) {
    queueOfflineRecord(record);
    offlineQueued = true;
  } else {
    try {
      const result = await sheetsAppendAttendance(record);
      if (result.duplicate) {
        // Sheets confirmed duplicate — still show success (first scan counted)
        showStudentInfo('Already Recorded', 'This device was already recorded in Sheets. Your first scan counted.', payload);
        return;
      }
    } catch(e) {
      // Sheets write failed — queue offline and continue
      queueOfflineRecord(record);
      offlineQueued = true;
    }
    // Also broadcast for same-device/same-LAN fallback
    broadcastAttendance(record);
    relayAttendance(record);
  }

  record.offlineQueued = offlineQueued;

  STATE.studentHistory.unshift({
    course: payload.crs, date: todayKey(),
    timestamp: record.timestamp,
    status: offlineQueued ? 'offline' : 'present',
    bleVerified,
  });
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
      googleProfile: STATE.googleProfile,
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
  STATE.googleProfile  = saved.googleProfile || null;
  STATE.attendance     = saved.attendance     || [];
  STATE.studentHistory = saved.studentHistory || [];
  STATE.offlineQueue   = saved.offlineQueue   || [];
  // OAuth token is never persisted — always reacquired silently
  STATE.sheetsReady = false;
  updateSheetsStatus();
  if (STATE.googleProfile) populateNavAvatar(STATE.role === 'lecturer' ? 'lecturer' : 'student');

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = STATE.user?.course || '';
    renderAttendanceTable(); updateStats();
    showScreen('lecturer');
    silentReauth(); // reacquire OAuth token for Sheets API

    if (saved.session && saved.session.endsAt > Date.now() && saved.session.date === todayKey()) {
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
      showToast('Previous session archived. Start a new session for today.', 'info');
    }
  } else if (STATE.role === 'student') {
    DOM.studentName.textContent          = STATE.user.name;
    DOM.studentMatricDisplay.textContent = STATE.user.matric ? `${STATE.user.matric} · ${STATE.user.course}` : STATE.user.course;
    DOM.deviceChip.title                 = `Device: ${getDeviceShort()}`;
    renderStudentHistory();
    silentReauth(); // reacquires token then startSheetsPoll() is called inside
    showScreen('student');
    updateOfflineUI();
    syncOfflineQueue();
    showToast(`Welcome back, ${STATE.user.name.split(' ')[0]}`, 'info');
  } else {
    showScreen('auth');
    initGoogleSSO();
  }
}

/** Attempt silent OAuth token refresh via GIS (no popup) */
function silentReauth() {
  if (typeof google === 'undefined' || !google.accounts?.oauth2) return;
  const clientId = window.SCHOOLER_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') return;
  const email = STATE.googleProfile?.email;
  if (!email) return;

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'openid', 'email', 'profile',
    ].join(' '),
    hint: email, // hint skips account picker for known user
    callback: async (tokenResponse) => {
      if (tokenResponse.error) return;
      sheetsSetToken(tokenResponse.access_token);
      sheetsSetEmail(email);
      if (STATE.role === 'lecturer') {
        try {
          await sheetsBootstrap(email);
          STATE.sheetsReady = true;
          updateSheetsStatus();
          startSheetsAttendancePoll(); // restart lecturer poll after reauth
        } catch(e) {}
      } else {
        STATE.sheetsReady = true;
        updateSheetsStatus();
        startSheetsPoll(); // restart student poll after reauth
      }
    },
  });
  // prompt:'' = silent if user already granted consent, no popup shown
  tokenClient.requestAccessToken({ prompt: '' });
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
