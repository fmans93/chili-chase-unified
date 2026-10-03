// =========================================================
// CHILI CHASE // UNIFIED
// core/xr.js
//
// Handles:
// - immersive-ar support
// - starting / ending AR
// - local-floor reference space
// - DOM overlay
// - optional hand tracking
// - XR session lifecycle
// - AR HUD state
//
// Hand/pinch gameplay is NOT handled here.
// That will live in input/glasses-hands.js.
// =========================================================

import {
  CONFIG,
  logConfig,
  warnConfig
} from "../config.js";

import {
  renderer,
  resetWorldTransform,
  setDesktopEnvironmentVisible
} from "./scene.js";

import {
  CAPABILITIES,
  setDeviceMode,
  setXRPresenting,
  updateXRCapabilities,
  updateStatusUI
} from "./capabilities.js";


// =========================================================
// XR STATE
// =========================================================

export const XR_STATE = {

  session: null,

  referenceSpace: null,

  presenting: false,

  handTracking: false,

  hitTest: false,

  domOverlay: false,

  inputSources: []

};


// =========================================================
// EVENT LISTENERS
//
// Other modules can subscribe without XR needing to know
// about Chili, lasso, movement, etc.
// =========================================================

const sessionStartListeners =
  new Set();

const sessionEndListeners =
  new Set();

const inputSourceListeners =
  new Set();


// =========================================================
// INITIALIZE XR BUTTON
// =========================================================

export function initializeXR() {

  const button =
    document.getElementById(
      "enter-ar"
    );


  if (!button) {

    warnConfig(
      "Could not find #enter-ar button."
    );

    return;

  }


  if (
    !CAPABILITIES.webXR
  ) {

    button.textContent =
      "AR UNAVAILABLE";

    button.disabled =
      true;

    return;

  }


  if (
    !CAPABILITIES.immersiveAR
  ) {

    button.textContent =
      "AR NOT SUPPORTED";

    button.disabled =
      true;

    return;

  }


  button.textContent =
    "ENTER AR";


  button.disabled =
    false;


  button.addEventListener(
    "click",
    async () => {

      if (
        XR_STATE.presenting
      ) {

        await endAR();

        return;

      }


      await startAR();

    }
  );


  logConfig(
    "XR controls initialized."
  );

}


// =========================================================
// START IMMERSIVE AR
// =========================================================

export async function startAR() {

  if (
    XR_STATE.presenting
  ) {

    return true;

  }


  if (
    !navigator.xr
  ) {

    showMessage(
      "WEBXR NOT AVAILABLE"
    );

    return false;

  }


  if (
    !renderer
  ) {

    showMessage(
      "RENDERER NOT READY"
    );

    return false;

  }


  logConfig(
    "Requesting immersive-ar session..."
  );


  showMessage(
    "STARTING AR..."
  );


  try {

    // -----------------------------------------------------
    // SESSION OPTIONS
    //
    // local-floor is the only required feature.
    //
    // Hand tracking, hit test and DOM overlay are optional
    // so a browser/device that lacks one of them can still
    // run the game.
    // -----------------------------------------------------

    const sessionInit = {

      requiredFeatures: [
        ...CONFIG.XR.REQUIRED_FEATURES
      ],

      optionalFeatures: [
        ...CONFIG.XR.OPTIONAL_FEATURES
      ],

      domOverlay: {
        root: document.body
      }

    };


    const session =

      await navigator.xr.requestSession(
        "immersive-ar",
        sessionInit
      );


    XR_STATE.session =
      session;


    // -----------------------------------------------------
    // CONNECT THREE.JS TO SESSION
    // -----------------------------------------------------

    await renderer.xr.setSession(
      session
    );


    XR_STATE.presenting =
      true;


    setXRPresenting(
      true
    );


    document.body.classList.add(
      "xr-presenting"
    );


    // -----------------------------------------------------
    // REFERENCE SPACE
    // -----------------------------------------------------

    try {

      XR_STATE.referenceSpace =

        await session.requestReferenceSpace(
          "local-floor"
        );

    }

    catch (error) {

      /*
        renderer.xr may still have a usable reference
        space, but local-floor was requested as required,
        so normally this should succeed.
      */

      warnConfig(
        "Could not obtain local-floor reference space:",
        error
      );


      XR_STATE.referenceSpace =
        renderer.xr.getReferenceSpace();

    }


    // -----------------------------------------------------
    // RESET VIRTUAL WORLD
    //
    // Every new AR session starts from a known transform.
    // -----------------------------------------------------

    resetWorldTransform();


    // -----------------------------------------------------
    // HIDE DESKTOP FLOOR
    //
    // The restaurant/room is now the environment.
    // -----------------------------------------------------

    setDesktopEnvironmentVisible(
      false
    );


    // -----------------------------------------------------
    // DETECT SESSION FEATURES
    // -----------------------------------------------------

    detectSessionCapabilities(
      session
    );


    // -----------------------------------------------------
    // MODE
    //
    // For our unified build, active immersive XR uses the
    // clean glasses/XR HUD.
    //
    // This does NOT mean every WebXR-capable device is
    // automatically a pair of glasses.
    // -----------------------------------------------------

    setDeviceMode(
      "xr"
    );


    // -----------------------------------------------------
    // SESSION EVENTS
    // -----------------------------------------------------

    session.addEventListener(
      "end",
      handleSessionEnded
    );


    session.addEventListener(
      "inputsourceschange",
      handleInputSourcesChanged
    );


    /*
      Capture the sources that already exist when the
      session starts.
    */

    refreshInputSources(
      session
    );


    // -----------------------------------------------------
    // BUTTON
    // -----------------------------------------------------

    const button =
      document.getElementById(
        "enter-ar"
      );


    if (button) {

      button.textContent =
        "EXIT AR";

    }


    // -----------------------------------------------------
    // NOTIFY OTHER MODULES
    // -----------------------------------------------------

    for (
      const listener
      of sessionStartListeners
    ) {

      try {

        listener(
          session,
          XR_STATE
        );

      }

      catch (error) {

        warnConfig(
          "XR session-start listener failed:",
          error
        );

      }

    }


    showMessage(
      "AR READY"
    );


    logConfig(
      "Immersive AR started.",
      {
        referenceSpace:
          Boolean(
            XR_STATE.referenceSpace
          ),

        inputSources:
          XR_STATE.inputSources.length,

        handTracking:
          XR_STATE.handTracking,

        hitTest:
          XR_STATE.hitTest,

        domOverlay:
          XR_STATE.domOverlay
      }
    );


    return true;

  }

  catch (error) {

    warnConfig(
      "Could not start immersive AR:",
      error
    );


    XR_STATE.session =
      null;

    XR_STATE.referenceSpace =
      null;

    XR_STATE.presenting =
      false;


    setXRPresenting(
      false
    );


    showMessage(
      "AR START FAILED"
    );


    return false;

  }

}


// =========================================================
// END AR
// =========================================================

export async function endAR() {

  if (
    !XR_STATE.session
  ) {

    return;

  }


  try {

    await XR_STATE.session.end();

  }

  catch (error) {

    warnConfig(
      "Could not end XR session:",
      error
    );

  }

}


// =========================================================
// SESSION ENDED
// =========================================================

function handleSessionEnded() {

  logConfig(
    "XR session ended."
  );


  const previousSession =
    XR_STATE.session;


  XR_STATE.session =
    null;


  XR_STATE.referenceSpace =
    null;


  XR_STATE.presenting =
    false;


  XR_STATE.handTracking =
    false;


  XR_STATE.hitTest =
    false;


  XR_STATE.domOverlay =
    false;


  XR_STATE.inputSources = [];


  setXRPresenting(
    false
  );


  document.body.classList.remove(
    "xr-presenting"
  );


  // -------------------------------------------------------
  // RESTORE DESKTOP TEST ENVIRONMENT
  // -------------------------------------------------------

  setDesktopEnvironmentVisible(
    true
  );


  // -------------------------------------------------------
  // RETURN TO APPROPRIATE NON-XR MODE
  // -------------------------------------------------------

  if (
    CAPABILITIES.mobileLike
  ) {

    setDeviceMode(
      "phone"
    );

  }

  else {

    setDeviceMode(
      "desktop"
    );

  }


  // -------------------------------------------------------
  // RESET XR FEATURE FLAGS
  // -------------------------------------------------------

  updateXRCapabilities({

    handTracking: false,

    hitTest: false,

    domOverlay: false

  });


  // -------------------------------------------------------
  // BUTTON
  // -------------------------------------------------------

  const button =
    document.getElementById(
      "enter-ar"
    );


  if (button) {

    button.textContent =
      "ENTER AR";

  }


  // -------------------------------------------------------
  // NOTIFY MODULES
  // -------------------------------------------------------

  for (
    const listener
    of sessionEndListeners
  ) {

    try {

      listener(
        previousSession
      );

    }

    catch (error) {

      warnConfig(
        "XR session-end listener failed:",
        error
      );

    }

  }


  showMessage(
    "AR ENDED"
  );


  updateStatusUI();

}


// =========================================================
// SESSION CAPABILITY DETECTION
// =========================================================

function detectSessionCapabilities(
  session
) {

  // -------------------------------------------------------
  // DOM OVERLAY
  // -------------------------------------------------------

  XR_STATE.domOverlay =
    Boolean(
      session.domOverlayState
    );


  // -------------------------------------------------------
  // HIT TEST
  //
  // WebXR does not provide a simple session.hitTest=true
  // property. requestHitTestSource existing is a useful
  // indicator after the feature has been granted.
  // -------------------------------------------------------

  XR_STATE.hitTest =

    typeof session.requestHitTestSource
      === "function";


  // -------------------------------------------------------
  // HAND TRACKING
  //
  // Actual hand availability is determined from XR input
  // sources. We do not claim hand tracking merely because
  // it was listed as an optional feature.
  // -------------------------------------------------------

  XR_STATE.handTracking =
    false;


  for (
    const source
    of session.inputSources
  ) {

    if (
      source.hand
    ) {

      XR_STATE.handTracking =
        true;

      break;

    }

  }


  updateXRCapabilities({

    handTracking:
      XR_STATE.handTracking,

    hitTest:
      XR_STATE.hitTest,

    domOverlay:
      XR_STATE.domOverlay

  });

}


// =========================================================
// INPUT SOURCES CHANGED
// =========================================================

function handleInputSourcesChanged(
  event
) {

  if (
    !XR_STATE.session
  ) {

    return;

  }


  refreshInputSources(
    XR_STATE.session
  );


  detectSessionCapabilities(
    XR_STATE.session
  );


  for (
    const listener
    of inputSourceListeners
  ) {

    try {

      listener(
        XR_STATE.inputSources,
        event
      );

    }

    catch (error) {

      warnConfig(
        "XR input-source listener failed:",
        error
      );

    }

  }

}


// =========================================================
// REFRESH INPUT SOURCES
// =========================================================

function refreshInputSources(
  session
) {

  XR_STATE.inputSources =

    Array.from(
      session.inputSources || []
    );


  logConfig(
    "XR input sources:",
    XR_STATE.inputSources.map(
      source => ({

        handedness:
          source.handedness,

        targetRayMode:
          source.targetRayMode,

        hand:
          Boolean(
            source.hand
          ),

        gamepad:
          Boolean(
            source.gamepad
          )

      })
    )
  );

}


// =========================================================
// GET CURRENT SESSION
// =========================================================

export function getXRSession() {

  return XR_STATE.session;

}


// =========================================================
// GET REFERENCE SPACE
// =========================================================

export function getXRReferenceSpace() {

  /*
    Prefer our explicit local-floor space.

    Fall back to Three.js if necessary.
  */

  return (

    XR_STATE.referenceSpace

    ||

    renderer?.xr?.getReferenceSpace?.()

    ||

    null

  );

}


// =========================================================
// GET INPUT SOURCES
// =========================================================

export function getXRInputSources() {

  return XR_STATE.inputSources;

}


// =========================================================
// IS PRESENTING
// =========================================================

export function isXRPresenting() {

  return XR_STATE.presenting;

}


// =========================================================
// SESSION START SUBSCRIPTION
// =========================================================

export function onXRSessionStart(
  callback
) {

  if (
    typeof callback !==
    "function"
  ) {

    return () => {};

  }


  sessionStartListeners.add(
    callback
  );


  return () => {

    sessionStartListeners.delete(
      callback
    );

  };

}


// =========================================================
// SESSION END SUBSCRIPTION
// =========================================================

export function onXRSessionEnd(
  callback
) {

  if (
    typeof callback !==
    "function"
  ) {

    return () => {};

  }


  sessionEndListeners.add(
    callback
  );


  return () => {

    sessionEndListeners.delete(
      callback
    );

  };

}


// =========================================================
// INPUT SOURCE SUBSCRIPTION
// =========================================================

export function onXRInputSourcesChanged(
  callback
) {

  if (
    typeof callback !==
    "function"
  ) {

    return () => {};

  }


  inputSourceListeners.add(
    callback
  );


  return () => {

    inputSourceListeners.delete(
      callback
    );

  };

}


// =========================================================
// FRAME POSE HELPER
//
// glasses-hands.js will use this.
//
// Given an XRFrame and XRInputSource, return the pose of
// its target ray relative to our local-floor space.
// =========================================================

export function getInputSourcePose(
  frame,
  inputSource
) {

  if (
    !frame ||
    !inputSource
  ) {

    return null;

  }


  const referenceSpace =
    getXRReferenceSpace();


  if (
    !referenceSpace
  ) {

    return null;

  }


  if (
    !inputSource.targetRaySpace
  ) {

    return null;

  }


  try {

    return frame.getPose(
      inputSource.targetRaySpace,
      referenceSpace
    );

  }

  catch {

    return null;

  }

}


// =========================================================
// UI MESSAGE
// =========================================================

function showMessage(
  text,
  duration = 1600
) {

  const element =
    document.getElementById(
      "game-message"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.classList.add(
    "show"
  );


  clearTimeout(
    showMessage.timeout
  );


  showMessage.timeout =
    setTimeout(
      () => {

        element.classList.remove(
          "show"
        );

      },
      duration
    );

}