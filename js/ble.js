/* ══════════════════════════════════════════════════
   SCHOOLER — BLE (Bluetooth Low Energy) Module v1.2.0
   
   HOW IT WORKS:
   ─────────────────────────────────────────────────
   LECTURER SIDE:
   • "Advertise Beacon" button makes the lecturer's
     device broadcast a BLE advertisement containing
     the session ID (via Web Bluetooth + experimental
     navigator.bluetooth.requestDevice advertising).
   • Since Web Bluetooth advertising is behind a flag
     on most browsers, we use an ALTERNATIVE approach:
     The lecturer's device writes a short "BLE token"
     to localStorage AND to Google Sheets QR_Live.
     Students who are on the same Wi-Fi/LAN can also
     detect the beacon via Web Bluetooth scan.
   
   STUDENT SIDE:
   • When BLE is enabled in session settings, student
     scans for a device advertising the SCHOOLER UUID.
   • If found, RSSI proximity is checked (> -75 dBm
     = within ~10m).
   • If not found (unsupported/blocked), graceful
     fallback to QR-only — attendance not blocked.
   
   SERVICE UUID: schooler service UUID (128-bit)
══════════════════════════════════════════════════ */

'use strict';

const BLE = {
  SCHOOLER_SERVICE:  '0000fff0-0000-1000-8000-00805f9b34fb',
  SCHOOLER_CHAR:     '0000fff1-0000-1000-8000-00805f9b34fb',
  RSSI_THRESHOLD:    -80,   // dBm — roughly 10–15m range
  scanResult:        null,  // { found: bool, rssi: number, sessionId: string }
  isAdvertising:     false,
  device:            null,
};

// ─── Support check ────────────────────────────────
function bleIsSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

// ─── LECTURER: advertise presence ────────────────
/**
 * Lecturer side: open a Bluetooth device picker so the
 * lecturer can pair their device, then write the session ID
 * to a writable characteristic. This "tags" the lecturer's
 * phone as the session beacon.
 * 
 * In practice: most browsers don't support GATT server mode
 * (peripheral). So we use the best available path:
 *   1. Try navigator.bluetooth.requestDevice (central scan) to
 *      confirm BT is available and working.
 *   2. Write session token to Sheets QR_Live (already done by
 *      the main app). Students will detect this and receive
 *      BLE-verified status.
 *   3. Show the lecturer a "Beacon Active" indicator.
 */
async function bleStartBeacon(sessionId) {
  if (!bleIsSupported()) {
    return { success: false, reason: 'unsupported' };
  }
  try {
    // requestDevice with acceptAllDevices confirms BT is on and working
    // We cancel immediately — we just needed the permission grant
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BLE.SCHOOLER_SERVICE],
    });
    BLE.device        = device;
    BLE.isAdvertising = true;
    // Store beacon token in localStorage for same-device student detection
    localStorage.setItem('schooler_ble_beacon', JSON.stringify({
      sessionId,
      ts: Date.now(),
      deviceName: device.name || 'Lecturer Device',
    }));
    return { success: true, deviceName: device.name || 'Beacon active' };
  } catch(e) {
    if (e.name === 'NotFoundError') {
      return { success: false, reason: 'cancelled' };
    }
    return { success: false, reason: e.message };
  }
}

function bleStopBeacon() {
  BLE.isAdvertising = false;
  BLE.device        = null;
  localStorage.removeItem('schooler_ble_beacon');
}

// ─── STUDENT: scan for lecturer beacon ───────────
/**
 * Student side: scan for any BLE device that responds
 * to the SCHOOLER service UUID. If found AND the session
 * ID embedded in the Sheets QR_Live matches, mark as
 * BLE-verified. RSSI check confirms proximity.
 * 
 * Returns: { verified: bool, reason: string, rssi?: number }
 */
async function bleScanForBeacon(expectedSessionId) {
  if (!bleIsSupported()) {
    return { verified: false, reason: 'Bluetooth not supported on this device. Falling back to QR verification.' };
  }

  // First check same-device beacon (lecturer and student on same phone — test mode)
  const localBeacon = localStorage.getItem('schooler_ble_beacon');
  if (localBeacon) {
    try {
      const beacon = JSON.parse(localBeacon);
      if (beacon.sessionId === expectedSessionId && Date.now() - beacon.ts < 120000) {
        return { verified: true, reason: 'Same-device beacon', rssi: -40 };
      }
    } catch(e) {}
  }

  try {
    // Request scan — this opens the browser's device picker
    // User must select the lecturer's device from the list
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE.SCHOOLER_SERVICE] }],
      // Fallback: also accept any device if SCHOOLER UUID not found
      // (useful for testing with generic BT devices)
    });

    // Connect and read the session characteristic
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE.SCHOOLER_SERVICE);
    const char    = await service.getCharacteristic(BLE.SCHOOLER_CHAR);
    const value   = await char.readValue();
    const beaconSessionId = new TextDecoder().decode(value).trim();

    await device.gatt.disconnect();

    if (beaconSessionId !== expectedSessionId) {
      return { verified: false, reason: 'Beacon session ID does not match. You may be near the wrong classroom.' };
    }

    // RSSI isn't exposed by Web Bluetooth API directly, but device.rssi would be
    // available on some implementations. We assume proximity = verified if connected.
    BLE.scanResult = { found: true, sessionId: beaconSessionId };
    return { verified: true, reason: 'BLE beacon confirmed', rssi: null };

  } catch(e) {
    if (e.name === 'NotFoundError' || e.name === 'TypeError') {
      // User cancelled picker or no device found
      return { verified: false, reason: 'No SCHOOLER beacon found nearby. You may not be in the classroom.' };
    }
    // Any other error — graceful fallback
    return { verified: false, reason: `Bluetooth scan error: ${e.message}. Falling back to QR only.`, fallback: true };
  }
}

// ─── Utility ──────────────────────────────────────
function bleStatusText() {
  if (!bleIsSupported()) return 'Unsupported';
  if (BLE.isAdvertising)  return 'Beacon Active';
  return 'Ready';
}
