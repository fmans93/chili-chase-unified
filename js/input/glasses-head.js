// =========================================================
// CHILI CHASE // UNIFIED
// input/glasses-head.js
//
// META / GLASSES HEAD CONTROL
//
// Built from the gyro system already tested on the
// glasses.
//
// Handles:
// - DeviceOrientation
// - alpha / beta / gamma
// - orientation permission
// - baseline calibration
// - recenter
// - wrap-safe yaw
// - pitch
// - smoothing
// - HUD head pointer
// - shared head input
//
// IMPORTANT:
//
// This module controls the HUD/head pointer.
//
// It does NOT replace the WebXR headset camera.
// In immersive XR the headset/runtime still owns the
// actual physical camera orientation.
// =========================================================

import {
  CONFIG,
  logConfig,
  warnConfig
} from "../config.js";

import {
  setHeadInput,
  clearHeadInput,
  emitCommand,
  COMMANDS
} from "./input-manager.js";

import {
  setHeadControlActive
} from "../core/capabilities.js";


// =========================================================
// STATE
// =========================================================

export const HEAD_STATE = {

  initialized: false,

  enabled: false,

  permissionGranted: false,

  hasReading: false,


  // Raw orientation

  alpha: 0,

  beta: 0,

  gamma: 0,


  // Calibration baseline

  baselineAlpha: null,

  baselineBeta: null,

  baselineGamma: null,


  // Relative orientation

  yaw: 0,

  pitch: 0,


  // Desired HUD pointer movement

  desiredX: 0,

  desiredY: 0,


  // Smoothed HUD pointer movement

  smoothX: 0,

  smoothY: 0,


  // Screen-space position

  screenX: 0,

  screenY: 0

};


// =========================================================
// ELEMENTS
// =========================================================

let headPointer = null;

let recenterButton = null;


// =========================================================
// INITIALIZE
// =========================================================

export function initializeGlassesHead() {

  if (
    HEAD_STATE.initialized
  ) {

    return;

  }


  headPointer =
    document.getElementById(
      "head-pointer"
    );


  recenterButton =
    document.getElementById(
      "recenter"
    );


  if (
    recenterButton
  ) {

    recenterButton.addEventListener(
      "click",
      handleRecenterPressed
    );

  }


  /*
    Do NOT immediately request orientation permission.

    iPhone/iOS and some browser environments require
    DeviceOrientation permission to be requested from a
    physical user interaction.

    main.js will call enableGlassesHead() when START is
    pressed.
  */


  window.addEventListener(
    "deviceorientation",
    handleOrientation,
    true
  );


  window.addEventListener(
    "orientationchange",
    handleScreenOrientationChange
  );


  HEAD_STATE.initialized =
    true;


  resetPointerVisual();


  logConfig(
    "Glasses head-control module initialized."
  );

}


// =========================================================
// ENABLE HEAD CONTROL
//
// Call this from a physical button press whenever possible.
// =========================================================

export async function enableGlassesHead() {

  if (
    !HEAD_STATE.initialized
  ) {

    initializeGlassesHead();

  }


  if (
    !("DeviceOrientationEvent" in window)
  ) {

    warnConfig(
      "DeviceOrientation is not available on this device."
    );


    setHeadControlActive(
      false
    );


    return false;

  }


  try {

    const OrientationEvent =
      window.DeviceOrientationEvent;


    // -----------------------------------------------------
    // IOS-STYLE PERMISSION
    // -----------------------------------------------------

    if (
      typeof OrientationEvent.requestPermission
      === "function"
    ) {

      const permission =

        await OrientationEvent.requestPermission();


      if (
        permission !==
        "granted"
      ) {

        warnConfig(
          "DeviceOrientation permission was not granted."
        );


        HEAD_STATE.permissionGranted =
          false;


        HEAD_STATE.enabled =
          false;


        setHeadControlActive(
          false
        );


        return false;

      }

    }


    HEAD_STATE.permissionGranted =
      true;


    HEAD_STATE.enabled =
      true;


    /*
      Do not reuse an old baseline.

      The first valid reading after enabling becomes our
      starting forward direction.
    */

    clearBaseline();


    document.body.classList.add(
      "head-control"
    );


    setHeadControlActive(
      true
    );


    logConfig(
      "Glasses head control enabled."
    );


    return true;

  }

  catch (error) {

    warnConfig(
      "Could not enable DeviceOrientation:",
      error
    );


    HEAD_STATE.permissionGranted =
      false;


    HEAD_STATE.enabled =
      false;


    setHeadControlActive(
      false
    );


    return false;

  }

}


// =========================================================
// DISABLE
// =========================================================

export function disableGlassesHead() {

  HEAD_STATE.enabled =
    false;


  HEAD_STATE.hasReading =
    false;


  document.body.classList.remove(
    "head-control"
  );


  clearHeadInput();


  setHeadControlActive(
    false
  );


  resetPointerVisual();

}


// =========================================================
// DEVICE ORIENTATION
// =========================================================

function handleOrientation(
  event
) {

  if (
    !HEAD_STATE.enabled
  ) {

    return;

  }


  const alpha =
    Number(event.alpha);


  const beta =
    Number(event.beta);


  const gamma =
    Number(event.gamma);


  /*
    alpha and beta are the important values for the
    head-pointer behavior.

    gamma is retained because it may become useful for
    glasses/UI stabilization later.
  */

  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(beta)
  ) {

    return;

  }


  HEAD_STATE.alpha =
    alpha;


  HEAD_STATE.beta =
    beta;


  HEAD_STATE.gamma =

    Number.isFinite(gamma)
      ? gamma
      : 0;


  HEAD_STATE.hasReading =
    true;


  // -------------------------------------------------------
  // FIRST READING = BASELINE
  // -------------------------------------------------------

  if (
    HEAD_STATE.baselineAlpha ===
    null
  ) {

    captureBaseline();


    return;

  }


  // -------------------------------------------------------
  // RELATIVE YAW
  //
  // We MUST use wrap-safe angular difference.
  //
  // Example:
  //
  // baseline = 359°
  // current  = 1°
  //
  // Actual movement is 2°, not -358°.
  // -------------------------------------------------------

  const yaw =
    angleDifference(
      alpha,
      HEAD_STATE.baselineAlpha
    );


  // -------------------------------------------------------
  // RELATIVE PITCH
  // -------------------------------------------------------

  const pitch =
    beta -
    HEAD_STATE.baselineBeta;


  HEAD_STATE.yaw =
    yaw;


  HEAD_STATE.pitch =
    pitch;


  // -------------------------------------------------------
  // POINTER TARGET
  //
  // Preserve the sensitivity setup from the working
  // glasses build.
  // -------------------------------------------------------

  HEAD_STATE.desiredX =

    yaw *
    CONFIG.HEAD.SENSITIVITY_X;


  HEAD_STATE.desiredY =

    pitch *
    CONFIG.HEAD.SENSITIVITY_Y;

}


// =========================================================
// FRAME UPDATE
//
// DeviceOrientation events give us targets.
//
// This function performs smoothing every render frame.
// =========================================================

export function updateGlassesHead(
  deltaTime
) {

  void deltaTime;


  if (
    !HEAD_STATE.enabled ||
    !HEAD_STATE.hasReading
  ) {

    return;

  }


  const smoothing =
    clamp(
      CONFIG.HEAD.SMOOTHING,
      0.01,
      1
    );


  // -------------------------------------------------------
  // SMOOTHING
  //
  // This preserves the proven behavior:
//
// smooth += (desired - smooth) * 0.15
// -------------------------------------------------------

  HEAD_STATE.smoothX +=

    (
      HEAD_STATE.desiredX -
      HEAD_STATE.smoothX
    )

    *

    smoothing;


  HEAD_STATE.smoothY +=

    (
      HEAD_STATE.desiredY -
      HEAD_STATE.smoothY
    )

    *

    smoothing;


  // -------------------------------------------------------
  // SCREEN LIMITS
  // -------------------------------------------------------

  const maxX =

    window.innerWidth *
    CONFIG.HEAD.MAX_SCREEN_X;


  const maxY =

    window.innerHeight *
    CONFIG.HEAD.MAX_SCREEN_Y;


  HEAD_STATE.screenX =
    clamp(
      HEAD_STATE.smoothX,
      -maxX,
      maxX
    );


  HEAD_STATE.screenY =
    clamp(
      HEAD_STATE.smoothY,
      -maxY,
      maxY
    );


  // -------------------------------------------------------
  // MOVE HEAD POINTER
  // -------------------------------------------------------

  if (
    headPointer
  ) {

    headPointer.style.transform =

      `translate(
        calc(-50% + ${HEAD_STATE.screenX}px),
        calc(-50% + ${HEAD_STATE.screenY}px)
      )`;

  }


  // -------------------------------------------------------
  // SEND TO SHARED INPUT SYSTEM
  // -------------------------------------------------------

  setHeadInput({

    x:
      HEAD_STATE.screenX,

    y:
      HEAD_STATE.screenY,

    yaw:
      HEAD_STATE.yaw,

    pitch:
      HEAD_STATE.pitch,

    active:
      true,

    source:
      "glasses-head"

  });

}


// =========================================================
// RECENTER
//
// Wherever the user is looking RIGHT NOW becomes:
//
//             CENTER / FORWARD
// =========================================================

export function recenterHead() {

  if (
    !HEAD_STATE.hasReading
  ) {

    return false;

  }


  captureBaseline();


  HEAD_STATE.yaw =
    0;


  HEAD_STATE.pitch =
    0;


  HEAD_STATE.desiredX =
    0;


  HEAD_STATE.desiredY =
    0;


  HEAD_STATE.smoothX =
    0;


  HEAD_STATE.smoothY =
    0;


  HEAD_STATE.screenX =
    0;


  HEAD_STATE.screenY =
    0;


  resetPointerVisual();


  setHeadInput({

    x: 0,

    y: 0,

    yaw: 0,

    pitch: 0,

    active: true,

    source:
      "glasses-head"

  });


  logConfig(
    "Head controls recentered."
  );


  return true;

}


// =========================================================
// RECENTER BUTTON
// =========================================================

function handleRecenterPressed(
  event
) {

  event?.preventDefault?.();


  recenterHead();


  emitCommand(
    COMMANDS.RECENTER,
    {
      source:
        "recenter-button"
    }
  );

}


// =========================================================
// CAPTURE CURRENT ORIENTATION AS CENTER
// =========================================================

function captureBaseline() {

  HEAD_STATE.baselineAlpha =
    HEAD_STATE.alpha;


  HEAD_STATE.baselineBeta =
    HEAD_STATE.beta;


  HEAD_STATE.baselineGamma =
    HEAD_STATE.gamma;


  HEAD_STATE.desiredX =
    0;


  HEAD_STATE.desiredY =
    0;


  HEAD_STATE.smoothX =
    0;


  HEAD_STATE.smoothY =
    0;


  HEAD_STATE.screenX =
    0;


  HEAD_STATE.screenY =
    0;


  logConfig(
    "Head baseline:",
    {
      alpha:
        HEAD_STATE.baselineAlpha,

      beta:
        HEAD_STATE.baselineBeta,

      gamma:
        HEAD_STATE.baselineGamma
    }
  );

}


// =========================================================
// CLEAR BASELINE
// =========================================================

function clearBaseline() {

  HEAD_STATE.baselineAlpha =
    null;


  HEAD_STATE.baselineBeta =
    null;


  HEAD_STATE.baselineGamma =
    null;


  HEAD_STATE.yaw =
    0;


  HEAD_STATE.pitch =
    0;


  HEAD_STATE.desiredX =
    0;


  HEAD_STATE.desiredY =
    0;


  HEAD_STATE.smoothX =
    0;


  HEAD_STATE.smoothY =
    0;

}


// =========================================================
// WRAP-SAFE ANGLE DIFFERENCE
//
// Returns:
//
// -180 ... +180
// =========================================================

function angleDifference(
  current,
  baseline
) {

  let difference =
    current -
    baseline;


  while (
    difference >
    180
  ) {

    difference -=
      360;

  }


  while (
    difference <
    -180
  ) {

    difference +=
      360;

  }


  return difference;

}


// =========================================================
// SCREEN ORIENTATION CHANGE
//
// Rotating the device can dramatically change beta/gamma.
// Recalibrate on the next sensor reading.
// =========================================================

function handleScreenOrientationChange() {

  if (
    !HEAD_STATE.enabled
  ) {

    return;

  }


  clearBaseline();


  resetPointerVisual();


  logConfig(
    "Screen orientation changed. Waiting for new head baseline."
  );

}


// =========================================================
// RESET POINTER
// =========================================================

function resetPointerVisual() {

  if (
    !headPointer
  ) {

    return;

  }


  headPointer.style.transform =
    "translate(-50%, -50%)";

}


// =========================================================
// GET HEAD POINTER POSITION
//
// Useful later for:
// - HUD targeting
// - dwell selection
// - menus
// - object interaction
// =========================================================

export function getHeadPointerPosition() {

  return {

    x:
      window.innerWidth / 2 +
      HEAD_STATE.screenX,

    y:
      window.innerHeight / 2 +
      HEAD_STATE.screenY,

    offsetX:
      HEAD_STATE.screenX,

    offsetY:
      HEAD_STATE.screenY

  };

}


// =========================================================
// GET ORIENTATION
// =========================================================

export function getHeadOrientation() {

  return {

    alpha:
      HEAD_STATE.alpha,

    beta:
      HEAD_STATE.beta,

    gamma:
      HEAD_STATE.gamma,

    yaw:
      HEAD_STATE.yaw,

    pitch:
      HEAD_STATE.pitch

  };

}


// =========================================================
// IS ACTIVE
// =========================================================

export function isHeadControlActive() {

  return (
    HEAD_STATE.enabled &&
    HEAD_STATE.hasReading
  );

}


// =========================================================
// CLAMP
// =========================================================

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );

}