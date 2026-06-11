/* ══════════════════════════════════════════════════
   SCHOOLER — Main App Logic
   Handles: Auth, Sessions, QR Gen, Geo-fencing,
            Scanner, Attendance, Export
══════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
const STATE = {
  role: null,           // 'lecturer' | 'student'
  user: null,           // { name, matric?, course, dept }
  session: null,        // active session object
  attendance: [],       // array of attendance records
  qrInterval: null,     // QR refresh interval
  sessionTimer: null,   // countdown timer
  scanActive: false,    // scanner running?
  scanStream: null,     // MediaStream
  scanAnimFrame: null,  // requestAnimationFrame id
  theme: 'dark',
};

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const GEO_RADIUS_METERS = 30;
const QR_REFRESH_SECS   = 10;
const APP_VERSION       = '1.0.0';
const STORAGE_KEY       = 'schooler_state';

// ═══════════════════════════════════════════════════
//  DOM REFS
// ═══════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const DOM = {
  splash:           $('splash'),
  authScreen:       $('authScreen'),
  lecturerDash:     $('lecturerDashboard'),
  studentDash:      $('studentDashboard'),
  // Auth
  authName:         $('authName'),
  authMatric:       $('authMatric'),
  authCourse:       $('authCourse'),
  authDept:         $('authDept'),
  authBtn:          $('authBtn'),
  matricGroup:      $('matricGroup'),
  courseGroup:      $('courseGroup'),
  deptGroup:        $('deptGroup'),
  roleTabs:         document.querySelectorAll('.role-tab'),
  // Stats
  statTotal:        $('statTotal'),
  statRate:         $('statRate'),
  statSession:      $('statSession'),
  // Session
  sessionCourse:    $('sessionCourse'),
  sessionDuration:  $('sessionDuration'),
  startSessionBtn:  $('startSessionBtn'),
  endSessionBtn:    $('endSessionBtn'),
  startSessionArea: $('startSessionArea'),
  activeSessionArea:$('activeSessionArea'),
  sessionStatusBadge:$('sessionStatusBadge'),
  // QR
  qrCanvas:         $('qrCanvas'),
  countdownNum:     $('countdownNum'),
  qrSessionCode:    $('qrSessionCode'),
  qrWrapper:        document.querySelector('.qr-wrapper'),
  // Active session info
  activeCourseName: $('activeCourseName'),
  activeStartTime:  $('activeStartTime'),
  activeTimeLeft:   $('activeTimeLeft'),
  geoStatusDisplay: $('geoStatusDisplay'),
  activePIN:        $('activePIN'),
  // Table
  attendanceBody:   $('attendanceBody'),
  exportBtn:        $('exportBtn'),
  clearAttendanceBtn:$('clearAttendanceBtn'),
  // Student
  studentName:      $('studentName'),
  studentMatricDisplay:$('studentMatricDisplay'),
  scannerVideo:     $('scannerVideo'),
  scannerCanvas:    $('scannerCanvas'),
  startScanBtn:     $('startScanBtn'),
  scanHint:         $('scanHint'),
  scanCard:         $('scanCard'),
  statusCard:       $('statusCard'),
  statusIcon:       $('statusIcon'),
  statusTitle:      $('statusTitle'),
  statusMsg:        $('statusMsg'),
  statusMeta:       $('statusMeta'),
  scanAgainBtn:     $('scanAgainBtn'),
  manualCode:       $('manualCode'),
  manualSubmitBtn:  $('manualSubmitBtn'),
  // UI
  toast:            $('toast'),
  modal:            $('modal'),
  modalTitle:       $('modalTitle'),
  modalMsg:         $('modalMsg'),
  modalCancel:      $('modalCancel'),
  modalConfirm:     $('modalConfirm'),
  themeToggle:      $('themeToggle'),
  themeToggleStudent:$('themeToggleStudent'),
  themeIconDark:    $('themeIconDark'),
  themeIconLight:   $('themeIconLight'),
  lecturerLogout:   $('lecturerLogout'),
  studentLogout:    $('studentLogout'),
};

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
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

function toggleTheme() {
  applyTheme(STATE.theme === 'dark' ? 'light' : 'dark');
}

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
//  AUTH
// ═══════════════════════════════════════════════════
let selectedRole = 'lecturer';

DOM.roleTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.roleTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedRole = tab.dataset.role;
    updateAuthForm();
  });
});

function updateAuthForm() {
  if (selectedRole === 'student') {
    DOM.matricGroup.style.display = '';
    DOM.courseGroup.style.display = '';
    DOM.deptGroup.style.display   = 'none';
    DOM.authName.placeholder  = 'e.g. Chiamaka Obi';
    DOM.authCourse.placeholder = 'e.g. CSC 325';
    DOM.authBtn.textContent   = 'Join as Student';
  } else {
    DOM.matricGroup.style.display = 'none';
    DOM.courseGroup.style.display = '';
    DOM.deptGroup.style.display   = '';
    DOM.authName.placeholder  = 'e.g. Dr. Emeka Okafor';
    DOM.authCourse.placeholder = 'e.g. CSC 325';
    DOM.authBtn.textContent   = 'Enter as Lecturer';
  }
}

DOM.authBtn.addEventListener('click', handleAuth);

function handleAuth() {
  const name   = DOM.authName.value.trim();
  const course = DOM.authCourse.value.trim();
  const dept   = DOM.authDept.value.trim();
  const matric = DOM.authMatric.value.trim();

  if (!name) { showToast('Please enter your name', 'error'); return; }
  if (!course) { showToast('Please enter a course code', 'error'); return; }
  if (selectedRole === 'student' && !matric) {
    showToast('Please enter your matric number', 'error'); return;
  }

  STATE.role = selectedRole;
  STATE.user = { name, course, dept, matric };

  saveStateSnapshot();

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = course;
    showScreen('lecturer');
    showToast(`Welcome, ${name}`, 'success');
  } else {
    DOM.studentName.textContent = name;
    DOM.studentMatricDisplay.textContent = matric ? `${matric} · ${course}` : course;
    showScreen('student');
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

  if (!course) { showToast('Enter a course code', 'error'); return; }

  // Get lecturer geolocation — this anchors the geo-fence
  showToast('Getting location…', 'info');
  let coords;
  try {
    coords = await getGeolocation();
  } catch (e) {
    showToast('Location required to start session', 'error');
    return;
  }

  const sessionId  = generateId(12);
  const pin        = generatePIN();
  const now        = Date.now();

  STATE.session = {
    id:        sessionId,
    course,
    pin,
    startedAt: now,
    endsAt:    now + duration * 60 * 1000,
    duration,
    lat:       coords.latitude,
    lng:       coords.longitude,
    accuracy:  coords.accuracy,
    qrToken:   null,
    qrExpiry:  null,
  };

  STATE.attendance = [];
  renderAttendanceTable();
  updateStats();

  // UI
  DOM.startSessionArea.style.display = 'none';
  DOM.activeSessionArea.style.display = '';
  DOM.activeCourseName.textContent = course;
  DOM.activeStartTime.textContent  = formatTime(new Date(now));
  DOM.activePIN.textContent        = pin;
  DOM.sessionStatusBadge.innerHTML = '<span class="dot active"></span> Active';

  // Start QR rotation
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

  // Session countdown timer
  updateSessionTimer();
  STATE.sessionTimer = setInterval(() => {
    updateSessionTimer();
    if (Date.now() >= STATE.session.endsAt) {
      endSession(false);
      showToast('Session time expired', 'info');
    }
  }, 1000);

  DOM.statSession.textContent = course;
  saveStateSnapshot();
  showToast('Session started! QR is live.', 'success');
}

function generateNewQR() {
  if (!STATE.session) return;

  // QR payload: JSON with session id, a rotating token, and expiry
  const token    = generateId(16);
  const expiry   = Date.now() + QR_REFRESH_SECS * 1000 + 2000; // 2s grace
  STATE.session.qrToken  = token;
  STATE.session.qrExpiry = expiry;

  const payload = JSON.stringify({
    sid:    STATE.session.id,
    tok:    token,
    exp:    expiry,
    crs:    STATE.session.course,
    pin:    STATE.session.pin,
    lat:    STATE.session.lat,
    lng:    STATE.session.lng,
    v:      APP_VERSION,
  });

  DOM.qrSessionCode.textContent = STATE.session.id.slice(0, 8).toUpperCase();

  // Draw QR onto canvas using QRious
  try {
    new QRious({
      element: DOM.qrCanvas,
      value:   payload,
      size:    220,
      level:   'H',
      background: '#ffffff',
      foreground: '#0d1630',
      padding: 12,
    });
  } catch(e) {
    console.error('QR gen error', e);
  }

  saveStateSnapshot();
}

function updateSessionTimer() {
  if (!STATE.session) return;
  const remaining = STATE.session.endsAt - Date.now();
  if (remaining <= 0) {
    DOM.activeTimeLeft.textContent = 'Ended';
    return;
  }
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  DOM.activeTimeLeft.textContent = `${m}m ${s.toString().padStart(2,'0')}s`;
}

function endSession(silent) {
  clearInterval(STATE.qrInterval);
  clearInterval(STATE.sessionTimer);
  STATE.qrInterval   = null;
  STATE.sessionTimer = null;

  STATE.session = null;

  DOM.startSessionArea.style.display  = '';
  DOM.activeSessionArea.style.display = 'none';
  DOM.sessionStatusBadge.innerHTML    = '<span class="dot inactive"></span> Inactive';
  DOM.statSession.textContent         = '—';
  DOM.activeTimeLeft.textContent      = '—';

  if (!silent) showToast('Session ended', 'info');
  saveStateSnapshot();
}

// ═══════════════════════════════════════════════════
//  ATTENDANCE LOG (LECTURER)
// ═══════════════════════════════════════════════════
function addAttendanceRecord(record) {
  // Prevent duplicate matric in same session
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
      <tr class="empty-row"><td colspan="6">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <p>No students checked in yet</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = STATE.attendance.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.name)}</td>
      <td>${escHtml(r.matric || '—')}</td>
      <td>${formatTime(new Date(r.timestamp))}</td>
      <td>${r.distance != null ? r.distance + 'm' : '—'}</td>
      <td><span class="status-chip ${r.suspicious ? 'suspicious' : 'present'}">
        ${r.suspicious ? '⚠ Verify' : '✓ Present'}
      </span></td>
    </tr>`).join('');
}

function updateStats() {
  const count = STATE.attendance.length;
  DOM.statTotal.textContent = count;
  // Rate: assume expected class size is unknown, show count
  DOM.statRate.textContent  = count > 0 ? count + ' in' : '0%';
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
  if (STATE.attendance.length === 0) {
    showToast('No attendance records to export', 'error');
    return;
  }

  const course  = STATE.session?.course || STATE.attendance[0]?.course || 'Course';
  const dateStr = new Date().toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
  const title   = `SCHOOLER Attendance — ${course} — ${dateStr}`;

  // Header rows
  const headerRows = [
    [title],
    [],
    ['#', 'Student Name', 'Matric Number', 'Check-in Time', 'Distance from Lecturer', 'Status', 'Course'],
  ];

  const dataRows = STATE.attendance.map((r, i) => [
    i + 1,
    r.name,
    r.matric || 'N/A',
    formatTime(new Date(r.timestamp)),
    r.distance != null ? `${r.distance}m` : 'N/A',
    r.suspicious ? 'Needs Verification' : 'Present',
    r.course || course,
  ]);

  const summaryRows = [
    [],
    ['Summary'],
    ['Total Present', STATE.attendance.length],
    ['Session Course', course],
    ['Export Date', new Date().toLocaleString('en-NG')],
    ['Generated by', 'SCHOOLER v' + APP_VERSION],
  ];

  const allRows = [...headerRows, ...dataRows, ...summaryRows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = [
    {wch:4}, {wch:26}, {wch:20}, {wch:18}, {wch:22}, {wch:20}, {wch:14}
  ];

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

  // First: get student location
  showToast('Getting your location…', 'info');
  try {
    await getGeolocation(); // verify permission
  } catch(e) {
    showToast('Location access is required to mark attendance', 'error');
    return;
  }

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
    STATE.scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  const canvas  = DOM.scannerCanvas;
  const ctx     = canvas.getContext('2d');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert'
  });

  if (code) {
    stopScanner();
    handleQRData(code.data);
    return;
  }

  STATE.scanAnimFrame = requestAnimationFrame(scanFrame);
}

function stopScanner() {
  STATE.scanActive = false;
  if (STATE.scanAnimFrame) cancelAnimationFrame(STATE.scanAnimFrame);
  if (STATE.scanStream) {
    STATE.scanStream.getTracks().forEach(t => t.stop());
    STATE.scanStream = null;
  }
  DOM.scannerVideo.srcObject = null;
  DOM.startScanBtn.style.display = '';
  DOM.scanHint.textContent = 'Tap to start camera';
}

async function handleQRData(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch(e) {
    showStudentError('Invalid QR Code', 'This QR code is not from SCHOOLER.');
    return;
  }

  // ── Validate structure
  if (!payload.sid || !payload.tok || !payload.exp || !payload.lat || !payload.lng) {
    showStudentError('Invalid QR Code', 'QR data is malformed or not from SCHOOLER.');
    return;
  }

  // ── Check expiry
  if (Date.now() > payload.exp) {
    showStudentError('QR Code Expired', 'This QR code has expired. Ask your lecturer for a fresh one — they refresh every 10 seconds.');
    return;
  }

  // ── Get student location
  let studentCoords;
  try {
    studentCoords = await getGeolocation();
  } catch(e) {
    showStudentError('Location Required', 'Enable location services to mark attendance. This prevents remote check-ins.');
    return;
  }

  // ── Check location accuracy — reject if too imprecise
  if (studentCoords.accuracy > 150) {
    showStudentError('Weak GPS Signal', `Your GPS accuracy is ${Math.round(studentCoords.accuracy)}m. Move to a clearer area and try again.`);
    return;
  }

  // ── Calculate distance from lecturer
  const dist = haversineDistance(
    studentCoords.latitude, studentCoords.longitude,
    payload.lat, payload.lng
  );

  const distRounded = Math.round(dist);

  // ── Geo-fence check
  if (dist > GEO_RADIUS_METERS) {
    showStudentError(
      'Too Far Away',
      `You are ${distRounded}m from the classroom. You must be within ${GEO_RADIUS_METERS}m to mark attendance. Remote check-ins are not allowed.`
    );
    return;
  }

  // ── Build record and broadcast to lecturer
  const record = {
    name:      STATE.user.name,
    matric:    STATE.user.matric || '',
    course:    payload.crs,
    timestamp: Date.now(),
    distance:  distRounded,
    sessionId: payload.sid,
    suspicious: false,
  };

  // Broadcast via BroadcastChannel so lecturer tab picks it up
  broadcastAttendance(record);

  // Also attempt localStorage relay
  relayAttendance(record);

  showStudentSuccess(record, distRounded);
}

function handleManualCode() {
  const raw = DOM.manualCode.value.trim();
  if (!raw) { showToast('Enter a session code', 'error'); return; }
  // Manual codes are the session's short ID displayed on QR panel
  // Try to find matching session via localStorage relay
  const relay = localStorage.getItem('schooler_session');
  if (!relay) {
    showToast('No active session found', 'error');
    return;
  }
  try {
    const session = JSON.parse(relay);
    if (session.id.slice(0,8).toUpperCase() === raw.toUpperCase() ||
        session.pin === raw.toUpperCase()) {
      // construct minimal payload and process
      const fakePayload = JSON.stringify({
        sid: session.id,
        tok: session.qrToken,
        exp: session.qrExpiry,
        crs: session.course,
        pin: session.pin,
        lat: session.lat,
        lng: session.lng,
        v:   APP_VERSION,
      });
      handleQRData(fakePayload);
    } else {
      showToast('Code does not match any active session', 'error');
    }
  } catch(e) {
    showToast('Could not verify code', 'error');
  }
}

// ── Student success / error display
function showStudentSuccess(record, dist) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');

  DOM.statusIcon.className = 'status-icon success';
  DOM.statusIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  DOM.statusTitle.textContent = 'Attendance Marked!';
  DOM.statusMsg.textContent   = 'You have been successfully recorded for this session.';
  DOM.statusMeta.innerHTML    = `
    <span>📚 ${escHtml(record.course)}</span>
    <span>⏱ ${formatTime(new Date(record.timestamp))}</span>
    <span>📍 ${dist}m from classroom</span>
    <span>👤 ${escHtml(record.name)} · ${escHtml(record.matric)}</span>`;

  showToast('Attendance recorded!', 'success');
}

function showStudentError(title, msg) {
  DOM.scanCard.classList.add('hidden');
  DOM.statusCard.classList.remove('hidden');

  DOM.statusIcon.className = 'status-icon error';
  DOM.statusIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  DOM.statusTitle.textContent = title;
  DOM.statusMsg.textContent   = msg;
  DOM.statusMeta.innerHTML    = '';

  showToast(title, 'error');
}

function resetStudentScan() {
  DOM.statusCard.classList.add('hidden');
  DOM.scanCard.classList.remove('hidden');
  DOM.manualCode.value = '';
}

// ═══════════════════════════════════════════════════
//  BROADCAST CHANNEL — real-time same-device comms
// ═══════════════════════════════════════════════════
let bc;
try { bc = new BroadcastChannel('schooler_attendance'); } catch(e) { bc = null; }

function broadcastAttendance(record) {
  if (bc) {
    bc.postMessage({ type: 'attendance', record });
  }
}

if (bc) {
  bc.onmessage = (event) => {
    if (event.data?.type === 'attendance' && STATE.role === 'lecturer') {
      const rec = event.data.record;
      // validate record is for current session
      if (STATE.session && rec.sessionId === STATE.session.id) {
        const added = addAttendanceRecord(rec);
        if (added) showToast(`${rec.name} checked in (${rec.distance}m)`, 'success');
      }
    }
  };
}

// localStorage relay for same-device different tab scenarios
function relayAttendance(record) {
  localStorage.setItem('schooler_checkin', JSON.stringify({
    record,
    ts: Date.now(),
  }));
}

// Poll localStorage for check-ins (for same-device fallback)
setInterval(() => {
  if (STATE.role !== 'lecturer' || !STATE.session) return;
  const raw = localStorage.getItem('schooler_checkin');
  if (!raw) return;
  try {
    const { record, ts } = JSON.parse(raw);
    if (Date.now() - ts > 20000) return; // ignore stale
    if (record.sessionId === STATE.session.id) {
      const added = addAttendanceRecord(record);
      if (added) {
        showToast(`${record.name} checked in (${record.distance}m)`, 'success');
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
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

// Haversine formula — returns metres between two lat/lng points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R   = 6371000; // Earth radius in metres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a   = Math.sin(dLat/2) * Math.sin(dLat/2)
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
            * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const toRad = d => d * Math.PI / 180;

// ═══════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════
function saveStateSnapshot() {
  try {
    const snap = {
      role:       STATE.role,
      user:       STATE.user,
      session:    STATE.session,
      attendance: STATE.attendance,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));

    // Also expose session publicly for student cross-tab lookup
    if (STATE.session) {
      localStorage.setItem('schooler_session', JSON.stringify(STATE.session));
    } else {
      localStorage.removeItem('schooler_session');
    }
  } catch(e) {}
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('schooler_session');
  localStorage.removeItem('schooler_checkin');
}

function restoreSession(saved) {
  STATE.role       = saved.role;
  STATE.user       = saved.user;
  STATE.attendance = saved.attendance || [];

  if (STATE.role === 'lecturer') {
    DOM.sessionCourse.value = STATE.user?.course || '';
    showScreen('lecturer');
    renderAttendanceTable();
    updateStats();

    if (saved.session && saved.session.endsAt > Date.now()) {
      // Restore active session
      STATE.session = saved.session;
      DOM.startSessionArea.style.display  = 'none';
      DOM.activeSessionArea.style.display = '';
      DOM.activeCourseName.textContent    = STATE.session.course;
      DOM.activeStartTime.textContent     = formatTime(new Date(STATE.session.startedAt));
      DOM.activePIN.textContent           = STATE.session.pin;
      DOM.sessionStatusBadge.innerHTML    = '<span class="dot active"></span> Active';
      DOM.statSession.textContent         = STATE.session.course;

      generateNewQR();
      let cd = QR_REFRESH_SECS;
      DOM.countdownNum.textContent = cd;
      STATE.qrInterval = setInterval(() => {
        cd--;
        DOM.countdownNum.textContent = cd;
        if (cd <= 0) {
          cd = QR_REFRESH_SECS;
          generateNewQR();
          DOM.qrWrapper.classList.add('flash');
          setTimeout(() => DOM.qrWrapper.classList.remove('flash'), 350);
        }
      }, 1000);

      updateSessionTimer();
      STATE.sessionTimer = setInterval(() => {
        updateSessionTimer();
        if (Date.now() >= STATE.session.endsAt) {
          endSession(false);
          showToast('Session time expired', 'info');
        }
      }, 1000);

      showToast(`Session restored — ${STATE.session.course}`, 'info');
    }
  } else if (STATE.role === 'student') {
    DOM.studentName.textContent          = STATE.user.name;
    DOM.studentMatricDisplay.textContent = STATE.user.matric
      ? `${STATE.user.matric} · ${STATE.user.course}`
      : STATE.user.course;
    showScreen('student');
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
  DOM.toast.textContent  = msg;
  DOM.toast.className    = `toast ${type}`;
  DOM.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), 3200);
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
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function generateId(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  arr.forEach(b => id += chars[b % chars.length]);
  return id;
}

function generatePIN() {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b % 10).join('') + '-' +
         Array.from(new Uint8Array(3).map((_,i) => arr[i] % 26 + 65)).map(c => String.fromCharCode(c)).join('');
}

// ═══════════════════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[SCHOOLER] SW registered'))
      .catch(e => console.warn('[SCHOOLER] SW failed:', e));
  });
}
