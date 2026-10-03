// =========================================================
// CHILI CHASE // UNIFIED
// core/capabilities.js
//
// Detects device/browser capabilities.
//
// IMPORTANT:
// We do not build separate games for:
// - Desktop
// - Phone
// - Glasses / XR
//
// We detect available capabilities and enable the
// appropriate input/output systems.
// =========================================================

import {
  logConfig,
  warnConfig
} from "../config.js";


// =========================================================
// CAPABILITY STATE
// =========================================================

export const CAPABILITIES = {

  // Basic device/input
  touch: false,
  coarsePointer: false,
  mobileLike: false,

  // Motion / gyro
  orientation: false,
  orientationPermissionRequired: false,

  // XR
  webXR: false,
  immersiveAR: false,

  // These are potential XR capabilities.
  // Actual support is confirmed after entering a session.
  handTracking: false,
  hitTest: false,
  domOverlay: false,

  // Current operating mode
  mode: "desktop",

  // Useful browser information
  userAgent: "",

  initialized: false

};


// =========================================================
// INITIAL DETECTION
// =========================================================

export async function detectCapabilities() {

  logConfig(
    "Detecting device capabilities..."
  );


  // -------------------------------------------------------
  // USER AGENT
  // -------------------------------------------------------

  CAPABILITIES.userAgent =
    navigator.userAgent || "";


  // -------------------------------------------------------
  // TOUCH
  // -------------------------------------------------------

  CAPABILITIES.touch =

    (
      "ontouchstart" in window
    )

    ||

    (
      navigator.maxTouchPoints > 0
    );


  // -------------------------------------------------------
  // COARSE POINTER
  // -------------------------------------------------------

  try {

    CAPABILITIES.coarsePointer =

      window.matchMedia(
        "(pointer: coarse)"
      ).matches;

  }

  catch {

    CAPABILITIES.coarsePointer =
      false;

  }


  // -------------------------------------------------------
  // MOBILE-LIKE DEVICE
  //
  // We intentionally do NOT rely only on userAgent.
  // Touch + coarse pointer is usually more useful for
  // deciding whether to display phone controls.
  // -------------------------------------------------------

  CAPABILITIES.mobileLike =

    CAPABILITIES.touch

    &&

    CAPABILITIES.coarsePointer;


  // -------------------------------------------------------
  // DEVICE ORIENTATION / GYRO
  // -------------------------------------------------------

  CAPABILITIES.orientation =

    "DeviceOrientationEvent" in window;


  /*
    iPhone/iPad Safari requires a physical user gesture
    before motion/orientation permission can be requested.

    Other browsers may expose DeviceOrientationEvent
    without requestPermission().
  */

  CAPABILITIES.orientationPermissionRequired =

    CAPABILITIES.orientation

    &&

    typeof DeviceOrientationEvent.requestPermission
      === "function";


  // -------------------------------------------------------
  // WEBXR
  // -------------------------------------------------------

  CAPABILITIES.webXR =

    "xr" in navigator

    &&

    navigator.xr != null;


  // -------------------------------------------------------
  // IMMERSIVE AR
  // -------------------------------------------------------

  CAPABILITIES.immersiveAR =
    false;


  if (CAPABILITIES.webXR) {

    try {

      CAPABILITIES.immersiveAR =

        await navigator.xr.isSessionSupported(
          "immersive-ar"
        );

    }

    catch (error) {

      warnConfig(
        "Could not check immersive-ar support:",
        error
      );

      CAPABILITIES.immersiveAR =
        false;

    }

  }


  // -------------------------------------------------------
  // DETERMINE INITIAL MODE
  // -------------------------------------------------------

  determineInitialMode();


  CAPABILITIES.initialized =
    true;


  updateBodyMode();

  updateStatusUI();


  logConfig(
    "Capabilities detected:",
    { ...CAPABILITIES }
  );


  return CAPABILITIES;

}


// =========================================================
// DETERMINE INITIAL MODE
// =========================================================

function determineInitialMode() {

  /*
    IMPORTANT:

    We do NOT automatically call something "glasses"
    merely because WebXR exists.

    A phone may also support immersive AR.

    Initial mode therefore remains phone/desktop.

    Once an XR session actually starts, xr.js can promote
    the interface into XR/glasses mode based on the
    session/input sources.
  */


  if (CAPABILITIES.mobileLike) {

    CAPABILITIES.mode =
      "phone";

    return;

  }


  CAPABILITIES.mode =
    "desktop";

}


// =========================================================
// SET MODE
// =========================================================

export function setDeviceMode(
  mode
) {

  const allowedModes = [

    "desktop",
    "phone",
    "glasses",
    "xr"

  ];


  if (
    !allowedModes.includes(mode)
  ) {

    warnConfig(
      `Unknown device mode: ${mode}`
    );

    return;

  }


  CAPABILITIES.mode =
    mode;


  updateBodyMode();

  updateStatusUI();


  logConfig(
    "Device mode:",
    mode
  );

}


// =========================================================
// BODY CSS MODE
// =========================================================

function updateBodyMode() {

  if (!document.body) {
    return;
  }


  document.body.classList.remove(

    "desktop-mode",
    "phone-mode",
    "glasses-mode"

  );


  switch (
    CAPABILITIES.mode
  ) {

    case "phone":

      document.body.classList.add(
        "phone-mode"
      );

      break;


    case "glasses":

      document.body.classList.add(
        "glasses-mode"
      );

      break;


    case "xr":

      /*
        Generic XR mode.

        We keep the HUD relatively clean until we know
        whether this session should specifically use our
        glasses interface.
      */

      document.body.classList.add(
        "glasses-mode"
      );

      break;


    default:

      document.body.classList.add(
        "desktop-mode"
      );

      break;

  }

}


// =========================================================
// STATUS UI
// =========================================================

export function updateStatusUI() {

  // -------------------------------------------------------
  // START SCREEN STATUS
  // -------------------------------------------------------

  const deviceStatus =
    document.getElementById(
      "device-status"
    );


  if (deviceStatus) {

    const parts = [];


    parts.push(
      `MODE: ${CAPABILITIES.mode.toUpperCase()}`
    );


    if (CAPABILITIES.touch) {

      parts.push(
        "TOUCH"
      );

    }


    if (CAPABILITIES.orientation) {

      parts.push(
        "GYRO"
      );

    }


    if (CAPABILITIES.immersiveAR) {

      parts.push(
        "AR READY"
      );

    }

    else if (
      CAPABILITIES.webXR
    ) {

      parts.push(
        "WEBXR"
      );

    }


    deviceStatus.textContent =
      parts.join(" // ");

  }


  // -------------------------------------------------------
  // DEBUG MODE
  // -------------------------------------------------------

  const modeValue =
    document.getElementById(
      "mode-value"
    );


  if (modeValue) {

    modeValue.textContent =
      CAPABILITIES.mode.toUpperCase();

  }


  // -------------------------------------------------------
  // XR STATUS
  // -------------------------------------------------------

  const xrValue =
    document.getElementById(
      "xr-value"
    );


  if (xrValue) {

    xrValue.textContent =

      CAPABILITIES.immersiveAR
        ? "READY"
        : "OFF";

  }


  // -------------------------------------------------------
  // HEAD STATUS
  // -------------------------------------------------------

  const headValue =
    document.getElementById(
      "head-value"
    );


  if (headValue) {

    headValue.textContent =

      CAPABILITIES.orientation
        ? "AVAILABLE"
        : "OFF";

  }


  // -------------------------------------------------------
  // HAND STATUS
  // -------------------------------------------------------

  const handValue =
    document.getElementById(
      "hand-value"
    );


  if (handValue) {

    /*
      Hand tracking cannot be truthfully confirmed until
      an XR session/input source exposes it.
    */

    handValue.textContent =

      CAPABILITIES.handTracking
        ? "READY"
        : "WAITING";

  }

}


// =========================================================
// MARK XR SESSION ACTIVE
// =========================================================

export function setXRPresenting(
  active
) {

  if (!document.body) {
    return;
  }


  document.body.classList.toggle(
    "xr-presenting",
    active
  );


  const xrValue =
    document.getElementById(
      "xr-value"
    );


  if (xrValue) {

    xrValue.textContent =

      active
        ? "ACTIVE"
        : (
            CAPABILITIES.immersiveAR
              ? "READY"
              : "OFF"
          );

  }

}


// =========================================================
// UPDATE XR CAPABILITIES
//
// Called after an XR session begins.
// =========================================================

export function updateXRCapabilities(
  {
    handTracking = false,
    hitTest = false,
    domOverlay = false
  } = {}
) {

  CAPABILITIES.handTracking =
    Boolean(handTracking);


  CAPABILITIES.hitTest =
    Boolean(hitTest);


  CAPABILITIES.domOverlay =
    Boolean(domOverlay);


  updateStatusUI();


  logConfig(
    "XR capabilities updated:",
    {
      handTracking:
        CAPABILITIES.handTracking,

      hitTest:
        CAPABILITIES.hitTest,

      domOverlay:
        CAPABILITIES.domOverlay
    }
  );

}


// =========================================================
// HEAD CONTROL CSS STATE
// =========================================================

export function setHeadControlActive(
  active
) {

  if (!document.body) {
    return;
  }


  document.body.classList.toggle(
    "head-control",
    Boolean(active)
  );


  const headValue =
    document.getElementById(
      "head-value"
    );


  if (headValue) {

    headValue.textContent =

      active
        ? "ACTIVE"
        : (
            CAPABILITIES.orientation
              ? "AVAILABLE"
              : "OFF"
          );

  }

}


// =========================================================
// HAND CONTROL STATUS
// =========================================================

export function setHandControlActive(
  active
) {

  const handValue =
    document.getElementById(
      "hand-value"
    );


  if (handValue) {

    handValue.textContent =

      active
        ? "ACTIVE"
        : (
            CAPABILITIES.handTracking
              ? "READY"
              : "WAITING"
          );

  }

}


// =========================================================
// REQUEST ORIENTATION PERMISSION
//
// MUST be called from a user gesture such as START,
// ENABLE HEAD, etc.
// =========================================================

export async function requestOrientationPermission() {

  if (
    !CAPABILITIES.orientation
  ) {

    warnConfig(
      "DeviceOrientationEvent is not available."
    );

    return false;

  }


  // -------------------------------------------------------
  // iOS-style permission flow
  // -------------------------------------------------------

  if (
    CAPABILITIES.orientationPermissionRequired
  ) {

    try {

      const result =

        await DeviceOrientationEvent
          .requestPermission();


      const granted =

        result === "granted";


      logConfig(
        "Orientation permission:",
        result
      );


      return granted;

    }

    catch (error) {

      warnConfig(
        "Orientation permission failed:",
        error
      );


      return false;

    }

  }


  // -------------------------------------------------------
  // Browser exposes orientation without explicit request
  // -------------------------------------------------------

  return true;

}


// =========================================================
// HELPER QUERIES
// =========================================================

export function isPhoneMode() {

  return (
    CAPABILITIES.mode ===
    "phone"
  );

}


export function isGlassesMode() {

  return (

    CAPABILITIES.mode ===
      "glasses"

    ||

    CAPABILITIES.mode ===
      "xr"

  );

}


export function supportsImmersiveAR() {

  return (
    CAPABILITIES.immersiveAR
  );

}


export function supportsOrientation() {

  return (
    CAPABILITIES.orientation
  );

}


export function supportsTouch() {

  return (
    CAPABILITIES.touch
  );

}