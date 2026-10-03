// =========================================================
// CHILI CHASE // UNIFIED
// input/glasses-hands.js
//
// META / XR HAND CONTROL
//
// Rebuilds the control behavior from the Soldier build
// that already worked on the glasses.
//
// SHORT PINCH:
//     LASSO / ACTION
//
// HOLD PINCH:
//     hand ray becomes locomotion control
//
//     ray left/right = turn
//     ray up/down    = forward/back
//
// IMPORTANT:
// In immersive XR we DO NOT manually move the headset
// camera.
//
// The XR runtime owns the camera.
//
// Artificial movement is created by moving/rotating the
// virtual WORLD_ROOT.
// =========================================================

import * as THREE from "three";

import {
  CONFIG,
  logConfig,
  warnConfig
} from "../config.js";

import {
  renderer,
  WORLD_ROOT,
  rotateXRWorld
} from "../core/scene.js";

import {
  XR_STATE,
  getXRReferenceSpace,
  onXRSessionStart,
  onXRSessionEnd
} from "../core/xr.js";

import {
  setHandInput,
  clearHandInput,
  emitCommand,
  COMMANDS
} from "./input-manager.js";

import {
  setHandControlActive
} from "../core/capabilities.js";


// =========================================================
// STATE
// =========================================================

export const HAND_STATE = {

  initialized: false,

  active: false,

  selectHeld: false,

  selectStartTime: 0,

  activeSource: null,

  handedness: "none",

  holdActivated: false,

  rayX: 0,

  rayY: 0,

  movingForward: 0,

  turning: 0

};


// =========================================================
// CURRENT XR RAY
//
// These are intentionally exported.
//
// Later the physical lasso system will use the SAME ray
// that the Meta controls are already using.
// =========================================================

export const XR_RAY = {

  valid: false,

  origin:
    new THREE.Vector3(),

  direction:
    new THREE.Vector3(
      0,
      0,
      -1
    )

};


// =========================================================
// TEMP OBJECTS
// =========================================================

const tempQuaternion =
  new THREE.Quaternion();

const tempPosition =
  new THREE.Vector3();

const tempDirection =
  new THREE.Vector3();

const tempForward =
  new THREE.Vector3();


// =========================================================
// SESSION EVENT REFERENCES
//
// We keep these so listeners can be removed cleanly.
// =========================================================

let attachedSession = null;


// =========================================================
// INITIALIZE
// =========================================================

export function initializeGlassesHands() {

  if (
    HAND_STATE.initialized
  ) {

    return;

  }


  // -------------------------------------------------------
  // XR SESSION START
  // -------------------------------------------------------

  onXRSessionStart(
    handleXRSessionStart
  );


  // -------------------------------------------------------
  // XR SESSION END
  // -------------------------------------------------------

  onXRSessionEnd(
    handleXRSessionEnd
  );


  HAND_STATE.initialized =
    true;


  logConfig(
    "Glasses hand-control module initialized."
  );

}


// =========================================================
// XR SESSION START
// =========================================================

function handleXRSessionStart(
  session
) {

  if (!session) {
    return;
  }


  detachSessionListeners();


  attachedSession =
    session;


  // -------------------------------------------------------
  // SELECT EVENTS
  //
  // On hand-tracking XR devices, selectstart/selectend
  // normally represent the pinch/select gesture.
  // -------------------------------------------------------

  session.addEventListener(
    "selectstart",
    beginXRSelect
  );


  session.addEventListener(
    "selectend",
    endXRSelect
  );


  session.addEventListener(
    "inputsourceschange",
    handleInputSourcesChange
  );


  refreshActiveSource();


  logConfig(
    "Glasses hand controls attached to XR session."
  );

}


// =========================================================
// XR SESSION END
// =========================================================

function handleXRSessionEnd() {

  detachSessionListeners();


  resetHandState();


  setHandControlActive(
    false
  );


  logConfig(
    "Glasses hand controls detached."
  );

}


// =========================================================
// DETACH SESSION LISTENERS
// =========================================================

function detachSessionListeners() {

  if (
    !attachedSession
  ) {

    return;

  }


  attachedSession.removeEventListener(
    "selectstart",
    beginXRSelect
  );


  attachedSession.removeEventListener(
    "selectend",
    endXRSelect
  );


  attachedSession.removeEventListener(
    "inputsourceschange",
    handleInputSourcesChange
  );


  attachedSession =
    null;

}


// =========================================================
// INPUT SOURCES CHANGED
// =========================================================

function handleInputSourcesChange() {

  refreshActiveSource();

}


// =========================================================
// CHOOSE ACTIVE XR SOURCE
//
// Prefer an actual tracked hand.
//
// If the runtime exposes select through another target-ray
// source, we can still use it as a fallback.
// =========================================================

function refreshActiveSource() {

  const session =
    attachedSession ||
    XR_STATE.session;


  if (
    !session
  ) {

    HAND_STATE.activeSource =
      null;


    HAND_STATE.active =
      false;


    setHandControlActive(
      false
    );


    return;

  }


  const sources =
    Array.from(
      session.inputSources || []
    );


  // -------------------------------------------------------
  // FIRST CHOICE: TRACKED HAND
  // -------------------------------------------------------

  let source =
    sources.find(
      item =>
        item.hand &&
        item.targetRaySpace
    );


  // -------------------------------------------------------
  // SECOND CHOICE: ANY TARGET-RAY SOURCE
  // -------------------------------------------------------

  if (!source) {

    source =
      sources.find(
        item =>
          item.targetRaySpace
      );

  }


  HAND_STATE.activeSource =
    source || null;


  HAND_STATE.active =
    Boolean(
      source
    );


  HAND_STATE.handedness =

    source?.handedness

    ||

    "none";


  setHandControlActive(
    Boolean(
      source?.hand
    )
  );


  if (source) {

    logConfig(
      "Active XR input source:",
      {
        handedness:
          source.handedness,

        hand:
          Boolean(
            source.hand
          ),

        targetRayMode:
          source.targetRayMode
      }
    );

  }

}


// =========================================================
// SELECT START
//
// This is the beginning of the pinch/select gesture.
// =========================================================

function beginXRSelect(
  event
) {

  const source =
    event.inputSource;


  if (
    !source
  ) {

    return;

  }


  HAND_STATE.activeSource =
    source;


  HAND_STATE.active =
    true;


  HAND_STATE.handedness =

    source.handedness

    ||

    "none";


  HAND_STATE.selectHeld =
    true;


  HAND_STATE.holdActivated =
    false;


  HAND_STATE.selectStartTime =
    performance.now();


  setHandControlActive(
    Boolean(
      source.hand
    )
  );


  logConfig(
    "XR pinch/select START",
    {
      handedness:
        HAND_STATE.handedness,

      hand:
        Boolean(
          source.hand
        )
    }
  );

}


// =========================================================
// SELECT END
//
// SHORT PINCH:
//
//     LASSO
//
// LONG HOLD:
//
//     stop locomotion
//
// This preserves the important distinction from the
// working glasses prototype.
// =========================================================

function endXRSelect(
  event
) {

  if (
    !HAND_STATE.selectHeld
  ) {

    return;

  }


  const duration =

    performance.now() -
    HAND_STATE.selectStartTime;


  const source =

    event.inputSource

    ||

    HAND_STATE.activeSource;


  HAND_STATE.selectHeld =
    false;


  // -------------------------------------------------------
  // SHORT PINCH = GAME ACTION
  // -------------------------------------------------------

  if (
    duration <
    CONFIG.HANDS.HOLD_THRESHOLD
  ) {

    /*
      Update the ray one more time if the event provides
      an XRFrame.

      Some runtimes provide event.frame.
    */

    if (
      event.frame &&
      source
    ) {

      updateRayFromSource(
        event.frame,
        source
      );

    }


    emitCommand(
      COMMANDS.LASSO,
      {
        source:
          "xr-short-pinch",

        handedness:
          source?.handedness ||
          "none",

        duration,

        rayOrigin:
          XR_RAY.valid
            ? XR_RAY.origin.clone()
            : null,

        rayDirection:
          XR_RAY.valid
            ? XR_RAY.direction.clone()
            : null
      }
    );


    logConfig(
      "XR short pinch → LASSO",
      Math.round(duration),
      "ms"
    );

  }

  // -------------------------------------------------------
  // LONG HOLD ENDED
  // -------------------------------------------------------

  else {

    logConfig(
      "XR movement hold ended:",
      Math.round(duration),
      "ms"
    );

  }


  HAND_STATE.holdActivated =
    false;


  HAND_STATE.rayX =
    0;


  HAND_STATE.rayY =
    0;


  HAND_STATE.movingForward =
    0;


  HAND_STATE.turning =
    0;


  setHandInput({

    x: 0,

    y: 0,

    active:
      Boolean(
        HAND_STATE.activeSource
      ),

    held: false,

    source:
      "xr-hand"

  });

}


// =========================================================
// FRAME UPDATE
//
// main.js will call:
//
// updateGlassesHands(frame, deltaTime)
//
// every XR frame.
// =========================================================

export function updateGlassesHands(
  frame,
  deltaTime
) {

  if (
    !XR_STATE.presenting
  ) {

    return;

  }


  if (
    !frame
  ) {

    return;

  }


  let source =
    HAND_STATE.activeSource;


  /*
    Input sources can appear after the session begins.
  */

  if (
    !source
  ) {

    refreshActiveSource();


    source =
      HAND_STATE.activeSource;

  }


  if (
    !source
  ) {

    XR_RAY.valid =
      false;


    clearHandInput();


    return;

  }


  // -------------------------------------------------------
  // UPDATE TARGET RAY
  // -------------------------------------------------------

  const rayValid =
    updateRayFromSource(
      frame,
      source
    );


  if (
    !rayValid
  ) {

    return;

  }


  // -------------------------------------------------------
  // NOT CURRENTLY PINCHING
  // -------------------------------------------------------

  if (
    !HAND_STATE.selectHeld
  ) {

    setHandInput({

      x:
        HAND_STATE.rayX,

      y:
        HAND_STATE.rayY,

      active: true,

      held: false,

      source:
        "xr-hand"

    });


    return;

  }


  // -------------------------------------------------------
  // HOW LONG HAS PINCH BEEN HELD?
  // -------------------------------------------------------

  const heldFor =

    performance.now() -
    HAND_STATE.selectStartTime;


  // -------------------------------------------------------
  // SHORT-PINCH WINDOW
  //
  // Do not move yet.
  //
  // We wait to determine whether this becomes a short
  // action pinch or a movement hold.
  // -------------------------------------------------------

  if (
    heldFor <
    CONFIG.HANDS.HOLD_THRESHOLD
  ) {

    setHandInput({

      x:
        HAND_STATE.rayX,

      y:
        HAND_STATE.rayY,

      active: true,

      held: true,

      source:
        "xr-hand"

    });


    return;

  }


  // -------------------------------------------------------
  // HOLD MODE ACTIVATED
  // -------------------------------------------------------

  HAND_STATE.holdActivated =
    true;


  applyXRMovement(
    deltaTime
  );


  setHandInput({

    x:
      HAND_STATE.rayX,

    y:
      HAND_STATE.rayY,

    active: true,

    held: true,

    source:
      "xr-hand"

  });

}


// =========================================================
// UPDATE XR TARGET RAY
//
// targetRaySpace gives us the pointing direction selected
// by the XR runtime.
//
// This is the same conceptual ray we will later use for
// the lasso.
// =========================================================

function updateRayFromSource(
  frame,
  source
) {

  const referenceSpace =
    getXRReferenceSpace();


  if (
    !referenceSpace ||
    !source?.targetRaySpace
  ) {

    XR_RAY.valid =
      false;


    return false;

  }


  let pose;


  try {

    pose =
      frame.getPose(
        source.targetRaySpace,
        referenceSpace
      );

  }

  catch (error) {

    XR_RAY.valid =
      false;


    return false;

  }


  if (
    !pose
  ) {

    XR_RAY.valid =
      false;


    return false;

  }


  // -------------------------------------------------------
  // POSITION
  // -------------------------------------------------------

  const position =
    pose.transform.position;


  XR_RAY.origin.set(

    position.x,

    position.y,

    position.z

  );


  // -------------------------------------------------------
  // ORIENTATION
  // -------------------------------------------------------

  const orientation =
    pose.transform.orientation;


  tempQuaternion.set(

    orientation.x,

    orientation.y,

    orientation.z,

    orientation.w

  );


  // -------------------------------------------------------
  // FORWARD RAY
  //
  // WebXR target-ray forward is -Z.
  // -------------------------------------------------------

  XR_RAY.direction
    .set(
      0,
      0,
      -1
    )
    .applyQuaternion(
      tempQuaternion
    )
    .normalize();


  XR_RAY.valid =
    true;


  // -------------------------------------------------------
  // CONTROL AXES
  //
  // The proven prototype used the hand target-ray
  // direction itself as the locomotion controller.
  //
  // X:
  // left/right
  //
  // Y:
  // up/down
  // -------------------------------------------------------

  HAND_STATE.rayX =
    XR_RAY.direction.x;


  HAND_STATE.rayY =
    XR_RAY.direction.y;


  return true;

}


// =========================================================
// APPLY XR MOVEMENT
//
// This preserves the movement model that worked in the
// glasses build.
//
// HAND RAY X:
//     turn
//
// HAND RAY Y:
//     forward/back
//
// The headset camera is NEVER manually translated.
// =========================================================

function applyXRMovement(
  deltaTime
) {

  if (
    !renderer?.xr?.isPresenting
  ) {

    return;

  }


  if (
    !WORLD_ROOT
  ) {

    return;

  }


  const rayX =
    HAND_STATE.rayX;


  const rayY =
    HAND_STATE.rayY;


  // =======================================================
  // TURN
  // =======================================================

  let turnInput =
    0;


  if (
    Math.abs(rayX) >
    CONFIG.HANDS.TURN_DEADZONE
  ) {

    turnInput =

      (
        Math.abs(rayX) -
        CONFIG.HANDS.TURN_DEADZONE
      )

      /

      (
        1 -
        CONFIG.HANDS.TURN_DEADZONE
      );


    turnInput *=
      Math.sign(rayX);


    turnInput =
      THREE.MathUtils.clamp(
        turnInput,
        -1,
        1
      );

  }


  HAND_STATE.turning =
    turnInput;


  if (
    turnInput !== 0
  ) {

    const turnAmount =

      -turnInput *

      CONFIG.HANDS.TURN_SPEED *

      deltaTime;


    rotateXRWorld(
      turnAmount
    );

  }


  // =======================================================
  // FORWARD / BACK
  //
  // With a target ray:
  //
  // point upward   -> negative direction.y
  // point downward -> positive direction.y
  //
  // The exact sign is kept isolated here so if the Meta
  // runtime reports the opposite orientation on hardware,
  // we only change this one section.
  // =======================================================

  let movementInput =
    0;


  if (
    rayY <
    -CONFIG.HANDS.MOVE_DEADZONE
  ) {

    // Forward

    movementInput =

      (
        -rayY -
        CONFIG.HANDS.MOVE_DEADZONE
      )

      /

      (
        1 -
        CONFIG.HANDS.MOVE_DEADZONE
      );

  }

  else if (
    rayY >
    CONFIG.HANDS.MOVE_DEADZONE
  ) {

    // Backward

    movementInput =

      -(

        (
          rayY -
          CONFIG.HANDS.MOVE_DEADZONE
        )

        /

        (
          1 -
          CONFIG.HANDS.MOVE_DEADZONE
        )

      );

  }


  movementInput =
    THREE.MathUtils.clamp(
      movementInput,
      -1,
      1
    );


  HAND_STATE.movingForward =
    movementInput;


  if (
    movementInput ===
    0
  ) {

    return;

  }


  // =======================================================
  // SPEED
  // =======================================================

  const baseSpeed =

    movementInput > 0

      ? CONFIG.HANDS.FORWARD_SPEED

      : CONFIG.HANDS.BACKWARD_SPEED;


  const speed =

    baseSpeed *

    CONFIG.HANDS.MOVEMENT_BOOST;


  const distance =

    Math.abs(
      movementInput
    )

    *

    speed

    *

    deltaTime;


  // =======================================================
  // GET XR CAMERA FORWARD
  //
  // Movement follows where the player is looking, not the
  // hand ray's world direction.
  // =======================================================

  const xrCamera =
    renderer.xr.getCamera();


  if (
    !xrCamera
  ) {

    return;

  }


  xrCamera.getWorldDirection(
    tempForward
  );


  // -------------------------------------------------------
  // FLOOR-PLANE MOVEMENT ONLY
  // -------------------------------------------------------

  tempForward.y =
    0;


  if (
    tempForward.lengthSq() <
    0.000001
  ) {

    return;

  }


  tempForward.normalize();


  // =======================================================
  // INTENDED PLAYER MOVEMENT
  // =======================================================

  const directionSign =

    movementInput > 0
      ? 1
      : -1;


  const dx =

    tempForward.x *
    distance *
    directionSign;


  const dz =

    tempForward.z *
    distance *
    directionSign;


  // =======================================================
  // CRITICAL XR RULE
  //
  // The headset owns the camera.
  //
  // To simulate the player moving +dx/+dz, move the
  // virtual world -dx/-dz.
  //
  // This is the technique from the working glasses build.
  // =======================================================

  WORLD_ROOT.position.x -=
    dx;


  WORLD_ROOT.position.z -=
    dz;

}


// =========================================================
// GET XR RAY
//
// Lasso will use this later.
// =========================================================

export function getXRHandRay() {

  if (
    !XR_RAY.valid
  ) {

    return null;

  }


  return {

    origin:
      XR_RAY.origin.clone(),

    direction:
      XR_RAY.direction.clone()

  };

}


// =========================================================
// GET ACTIVE SOURCE
// =========================================================

export function getActiveXRSource() {

  return HAND_STATE.activeSource;

}


// =========================================================
// IS PINCH HELD
// =========================================================

export function isXRSelectHeld() {

  return HAND_STATE.selectHeld;

}


// =========================================================
// IS MOVEMENT HOLD ACTIVE
// =========================================================

export function isXRMovementHoldActive() {

  return (
    HAND_STATE.selectHeld &&
    HAND_STATE.holdActivated
  );

}


// =========================================================
// RESET
// =========================================================

function resetHandState() {

  HAND_STATE.active =
    false;


  HAND_STATE.selectHeld =
    false;


  HAND_STATE.selectStartTime =
    0;


  HAND_STATE.activeSource =
    null;


  HAND_STATE.handedness =
    "none";


  HAND_STATE.holdActivated =
    false;


  HAND_STATE.rayX =
    0;


  HAND_STATE.rayY =
    0;


  HAND_STATE.movingForward =
    0;


  HAND_STATE.turning =
    0;


  XR_RAY.valid =
    false;


  clearHandInput();

}