// ============================================================
// CHILI CHASE UNIFIED
// js/core/capabilities.js
//
// Device / browser capability detection.
//
// IMPORTANT:
// - Phone is a primary gameplay target.
// - Meta / XR glasses are a primary gameplay target.
// - Laptop is development/debug only.
// - Detection must NEVER block the START button.
// ============================================================

export const CAPABILITIES = {
  touch: false,
  coarsePointer: false,
  mobileLike: false,

  orientation: false,
  orientationPermissionRequired: false,

  webXR: false,
  immersiveAR: false,

  handTracking: false,
  hitTest: false,
  domOverlay: false,

  mode: "unknown",
  userAgent: "",

  initialized: false
};


// ------------------------------------------------------------
// Detect device/browser capabilities
// ------------------------------------------------------------

export async function detectCapabilities() {
  console.log("[CHILI] Detecting capabilities...");

  CAPABILITIES.userAgent = navigator.userAgent || "";

  // ----------------------------------------------------------
  // TOUCH
  // ----------------------------------------------------------

  CAPABILITIES.touch =
    ("ontouchstart" in window) ||
    (navigator.maxTouchPoints > 0);


  // ----------------------------------------------------------
  // POINTER TYPE
  // ----------------------------------------------------------

  try {
    CAPABILITIES.coarsePointer =
      window.matchMedia("(pointer: coarse)").matches;
  } catch (error) {
    CAPABILITIES.coarsePointer = false;
  }


  // ----------------------------------------------------------
  // MOBILE-LIKE DEVICE
  //
  // Do NOT rely only on user-agent strings.
  // ----------------------------------------------------------

  CAPABILITIES.mobileLike =
    CAPABILITIES.touch ||
    CAPABILITIES.coarsePointer ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(
      CAPABILITIES.userAgent
    );


  // ----------------------------------------------------------
  // DEVICE ORIENTATION / GYRO
  // ----------------------------------------------------------

  CAPABILITIES.orientation =
    ("DeviceOrientationEvent" in window);

  CAPABILITIES.orientationPermissionRequired =
    CAPABILITIES.orientation &&
    typeof DeviceOrientationEvent.requestPermission === "function";


  // ----------------------------------------------------------
  // WEBXR
  // ----------------------------------------------------------

  CAPABILITIES.webXR =
    !!navigator.xr &&
    typeof navigator.xr.isSessionSupported === "function";


  // ----------------------------------------------------------
  // IMMERSIVE AR
  //
  // This check can fail or take time on some browsers.
  // It must NEVER prevent the game from starting.
  // ----------------------------------------------------------

  CAPABILITIES.immersiveAR = false;

  if (CAPABILITIES.webXR) {
    try {
      CAPABILITIES.immersiveAR =
        await navigator.xr.isSessionSupported("immersive-ar");
    } catch (error) {
      console.warn(
        "[CHILI] immersive-ar capability check failed:",
        error
      );

      CAPABILITIES.immersiveAR = false;
    }
  }


  // ----------------------------------------------------------
  // XR OPTIONAL FEATURES
  //
  // These cannot always be confirmed until an XR session
  // actually begins. These values mean the browser/device
  // may support them.
  // ----------------------------------------------------------

  CAPABILITIES.handTracking =
    CAPABILITIES.webXR;

  CAPABILITIES.hitTest =
    CAPABILITIES.webXR;

  CAPABILITIES.domOverlay =
    CAPABILITIES.webXR;


  // ----------------------------------------------------------
  // INITIAL DEVICE MODE
  //
  // "phone" means touch/mobile browser.
  // "desktop" is only our development/debug fallback.
  // XR can later change this mode when a session starts.
  // ----------------------------------------------------------

  if (CAPABILITIES.mobileLike) {
    CAPABILITIES.mode = "phone";
  } else {
    CAPABILITIES.mode = "desktop";
  }

  CAPABILITIES.initialized = true;


  console.log("[CHILI] Capabilities detected:", {
    touch: CAPABILITIES.touch,
    coarsePointer: CAPABILITIES.coarsePointer,
    mobileLike: CAPABILITIES.mobileLike,
    orientation: CAPABILITIES.orientation,
    orientationPermissionRequired:
      CAPABILITIES.orientationPermissionRequired,
    webXR: CAPABILITIES.webXR,
    immersiveAR: CAPABILITIES.immersiveAR,
    mode: CAPABILITIES.mode
  });


  // Update start-screen text immediately.
  updateDeviceStatus();

  return CAPABILITIES;
}


// ------------------------------------------------------------
// Change current gameplay mode
// ------------------------------------------------------------

export function setDeviceMode(mode) {
  CAPABILITIES.mode = mode || "unknown";

  document.body.classList.remove(
    "phone",
    "desktop",
    "glasses",
    "xr"
  );

  if (CAPABILITIES.mode) {
    document.body.classList.add(CAPABILITIES.mode);
  }

  updateDeviceStatus();
  updateDebugUI();

  console.log(
    "[CHILI] Device mode:",
    CAPABILITIES.mode
  );
}


// ------------------------------------------------------------
// Device status shown on START screen
// ------------------------------------------------------------

export function updateDeviceStatus() {
  const element =
    document.getElementById("device-status");

  if (!element) return;


  // Detection still running
  if (!CAPABILITIES.initialized) {
    element.textContent = "DETECTING DEVICE...";
    return;
  }


  // Mobile / phone
  if (CAPABILITIES.mobileLike) {
    if (CAPABILITIES.immersiveAR) {
      element.textContent =
        "PHONE READY • AR AVAILABLE";
    } else {
      element.textContent =
        "PHONE READY";
    }

    return;
  }


  // Desktop debug environment
  if (CAPABILITIES.immersiveAR) {
    element.textContent =
      "XR DEVICE READY";
  } else {
    element.textContent =
      "DEBUG MODE";
  }
}


// ------------------------------------------------------------
// Ask for gyro permission
//
// iOS requires this from a physical user interaction.
// Android normally does not.
// ------------------------------------------------------------

export async function requestOrientationPermission() {
  if (!CAPABILITIES.orientation) {
    console.log(
      "[CHILI] Device orientation unavailable."
    );

    return false;
  }


  // Browser does not require explicit permission.
  if (!CAPABILITIES.orientationPermissionRequired) {
    return true;
  }


  try {
    const result =
      await DeviceOrientationEvent.requestPermission();

    const granted =
      result === "granted";

    console.log(
      "[CHILI] Orientation permission:",
      result
    );

    return granted;

  } catch (error) {

    console.warn(
      "[CHILI] Orientation permission failed:",
      error
    );

    return false;
  }
}


// ------------------------------------------------------------
// Debug HUD
// ------------------------------------------------------------

export function updateDebugUI() {
  const modeElement =
    document.getElementById("debug-mode");

  const xrElement =
    document.getElementById("debug-xr");

  const headElement =
    document.getElementById("debug-head");

  const handElement =
    document.getElementById("debug-hand");


  if (modeElement) {
    modeElement.textContent =
      `MODE: ${String(
        CAPABILITIES.mode
      ).toUpperCase()}`;
  }


  if (xrElement) {
    xrElement.textContent =
      `XR: ${
        CAPABILITIES.immersiveAR
          ? "YES"
          : "NO"
      }`;
  }


  if (headElement) {
    headElement.textContent =
      `HEAD: ${
        CAPABILITIES.orientation
          ? "YES"
          : "NO"
      }`;
  }


  if (handElement) {
    handElement.textContent =
      `HAND: ${
        CAPABILITIES.handTracking
          ? "POSSIBLE"
          : "NO"
      }`;
  }
}


// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function isPhoneLike() {
  return CAPABILITIES.mobileLike;
}


export function isImmersiveARSupported() {
  return CAPABILITIES.immersiveAR;
}


export function hasOrientationSupport() {
  return CAPABILITIES.orientation;
}


export function getDeviceMode() {
  return CAPABILITIES.mode;
}