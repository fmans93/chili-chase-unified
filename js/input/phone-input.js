// =========================================================
// CHILI CHASE // UNIFIED
// input/phone-input.js
//
// PHONE CONTROLS
//
// - Left virtual joystick = movement
// - LASSO button = lasso/action
// - Hold SPRINT = sprint
//
// This module does NOT contain Chili/game logic.
// It only translates phone controls into our shared
// INPUT system.
// =========================================================

import {
  CONFIG,
  logConfig,
  warnConfig
} from "../config.js";

import {
  setMovement,
  setSprint,
  emitCommand,
  COMMANDS,
  stopMovement
} from "./input-manager.js";

import {
  isXRPresenting
} from "../core/xr.js";


// =========================================================
// STATE
// =========================================================

let initialized = false;


// Joystick

let joystickPointerId = null;

let joystickActive = false;

let joystickCenterX = 0;

let joystickCenterY = 0;


// Sprint

let sprintPointerId = null;


// =========================================================
// ELEMENTS
// =========================================================

let joystickElement = null;

let joystickKnob = null;

let lassoButton = null;

let sprintButton = null;


// =========================================================
// INITIALIZE PHONE INPUT
// =========================================================

export function initializePhoneInput() {

  if (initialized) {
    return;
  }


  joystickElement =
    document.getElementById(
      "phone-joystick"
    );


  /*
    Some versions of our HUD may call the inner joystick:

      joystick-knob

    while another version may use:

      joystick-stick

    Support either name.
  */

  joystickKnob =

    document.getElementById(
      "joystick-knob"
    )

    ||

    document.getElementById(
      "joystick-stick"
    )

    ||

    joystickElement?.querySelector(
      ".joystick-knob"
    )

    ||

    joystickElement?.querySelector(
      ".joystick-stick"
    )

    ||

    joystickElement?.firstElementChild

    ||

    null;


  lassoButton =
    document.getElementById(
      "lasso-button"
    );


  sprintButton =
    document.getElementById(
      "sprint-button"
    );


  // =======================================================
  // JOYSTICK
  // =======================================================

  if (joystickElement) {

    joystickElement.addEventListener(
      "pointerdown",
      handleJoystickStart
    );


    joystickElement.addEventListener(
      "pointermove",
      handleJoystickMove
    );


    joystickElement.addEventListener(
      "pointerup",
      handleJoystickEnd
    );


    joystickElement.addEventListener(
      "pointercancel",
      handleJoystickEnd
    );


    joystickElement.addEventListener(
      "lostpointercapture",
      handleJoystickLostCapture
    );

  }

  else {

    warnConfig(
      "Phone joystick element #phone-joystick was not found."
    );

  }


  // =======================================================
  // LASSO BUTTON
  // =======================================================

  if (lassoButton) {

    lassoButton.addEventListener(
      "pointerdown",
      handleLasso
    );

  }

  else {

    warnConfig(
      "Phone lasso button #lasso-button was not found."
    );

  }


  // =======================================================
  // SPRINT BUTTON
  // =======================================================

  if (sprintButton) {

    sprintButton.addEventListener(
      "pointerdown",
      handleSprintStart
    );


    sprintButton.addEventListener(
      "pointerup",
      handleSprintEnd
    );


    sprintButton.addEventListener(
      "pointercancel",
      handleSprintEnd
    );


    sprintButton.addEventListener(
      "lostpointercapture",
      handleSprintLostCapture
    );

  }

  else {

    warnConfig(
      "Phone sprint button #sprint-button was not found."
    );

  }


  // =======================================================
  // PREVENT CONTEXT MENU
  //
  // Long-pressing controls should not open browser menus.
  // =======================================================

  joystickElement?.addEventListener(
    "contextmenu",
    preventDefault
  );


  lassoButton?.addEventListener(
    "contextmenu",
    preventDefault
  );


  sprintButton?.addEventListener(
    "contextmenu",
    preventDefault
  );


  // =======================================================
  // PAGE SAFETY
  // =======================================================

  window.addEventListener(
    "blur",
    resetPhoneInput
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {

        resetPhoneInput();

      }

    }
  );


  initialized = true;


  resetJoystickVisual();


  logConfig(
    "Phone input initialized."
  );

}


// =========================================================
// JOYSTICK START
// =========================================================

function handleJoystickStart(
  event
) {

  /*
    Once the actual XR/glasses session is controlling the
    game, don't allow a touch event to fight it.
  */

  if (
    isXRPresenting()
  ) {

    return;

  }


  if (
    joystickPointerId !== null
  ) {

    return;

  }


  event.preventDefault();


  joystickPointerId =
    event.pointerId;


  joystickActive =
    true;


  try {

    joystickElement.setPointerCapture(
      event.pointerId
    );

  }

  catch {
    // Not fatal.
  }


  updateJoystickCenter();


  updateJoystickFromPointer(
    event.clientX,
    event.clientY
  );

}


// =========================================================
// JOYSTICK MOVE
// =========================================================

function handleJoystickMove(
  event
) {

  if (
    !joystickActive
  ) {

    return;

  }


  if (
    event.pointerId !==
    joystickPointerId
  ) {

    return;

  }


  event.preventDefault();


  updateJoystickFromPointer(
    event.clientX,
    event.clientY
  );

}


// =========================================================
// JOYSTICK END
// =========================================================

function handleJoystickEnd(
  event
) {

  if (
    event.pointerId !==
    joystickPointerId
  ) {

    return;

  }


  event.preventDefault();


  try {

    if (
      joystickElement.hasPointerCapture(
        event.pointerId
      )
    ) {

      joystickElement.releasePointerCapture(
        event.pointerId
      );

    }

  }

  catch {
    // Not fatal.
  }


  joystickPointerId =
    null;


  joystickActive =
    false;


  setMovement(
    0,
    0,
    "phone"
  );


  resetJoystickVisual();

}


// =========================================================
// LOST JOYSTICK POINTER
// =========================================================

function handleJoystickLostCapture(
  event
) {

  if (
    event.pointerId !==
    joystickPointerId
  ) {

    return;

  }


  joystickPointerId =
    null;


  joystickActive =
    false;


  setMovement(
    0,
    0,
    "phone"
  );


  resetJoystickVisual();

}


// =========================================================
// UPDATE JOYSTICK CENTER
// =========================================================

function updateJoystickCenter() {

  if (!joystickElement) {
    return;
  }


  const rect =
    joystickElement.getBoundingClientRect();


  joystickCenterX =
    rect.left +
    rect.width / 2;


  joystickCenterY =
    rect.top +
    rect.height / 2;

}


// =========================================================
// JOYSTICK CALCULATION
// =========================================================

function updateJoystickFromPointer(
  clientX,
  clientY
) {

  if (
    !joystickElement
  ) {

    return;

  }


  const dx =
    clientX -
    joystickCenterX;


  const dy =
    clientY -
    joystickCenterY;


  // -------------------------------------------------------
  // MAXIMUM STICK DISTANCE
  // -------------------------------------------------------

  const radius =

    CONFIG.PHONE.JOYSTICK_RADIUS

    ||

    Math.max(
      30,
      joystickElement.clientWidth *
      0.35
    );


  const distance =
    Math.hypot(
      dx,
      dy
    );


  let stickX =
    dx;


  let stickY =
    dy;


  if (
    distance >
    radius
  ) {

    const scale =
      radius /
      distance;


    stickX *=
      scale;


    stickY *=
      scale;

  }


  // -------------------------------------------------------
  // VISUAL KNOB
  // -------------------------------------------------------

  if (
    joystickKnob
  ) {

    joystickKnob.style.transform =

      `translate(${stickX}px, ${stickY}px)`;

  }


  // -------------------------------------------------------
  // NORMALIZED INPUT
  //
  // Browser Y increases downward.
  //
  // Therefore:
  //
  // stick up   = positive forward
  // stick down = negative forward
  // -------------------------------------------------------

  let moveX =
    stickX /
    radius;


  let moveZ =
    -stickY /
    radius;


  // -------------------------------------------------------
  // SMALL DEADZONE
  // -------------------------------------------------------

  const magnitude =
    Math.hypot(
      moveX,
      moveZ
    );


  const deadzone =
    0.10;


  if (
    magnitude <
    deadzone
  ) {

    moveX =
      0;


    moveZ =
      0;

  }

  else {

    /*
      Remap after the deadzone so movement still reaches
      full strength at the edge.
    */

    const correctedMagnitude =

      Math.min(
        1,
        (
          magnitude -
          deadzone
        ) /
        (
          1 -
          deadzone
        )
      );


    if (
      magnitude >
      0
    ) {

      moveX =

        (
          moveX /
          magnitude
        ) *
        correctedMagnitude;


      moveZ =

        (
          moveZ /
          magnitude
        ) *
        correctedMagnitude;

    }

  }


  setMovement(
    moveX,
    moveZ,
    "phone"
  );

}


// =========================================================
// RESET JOYSTICK VISUAL
// =========================================================

function resetJoystickVisual() {

  if (
    joystickKnob
  ) {

    joystickKnob.style.transform =
      "translate(0px, 0px)";

  }

}


// =========================================================
// LASSO
// =========================================================

function handleLasso(
  event
) {

  if (
    isXRPresenting()
  ) {

    return;

  }


  event.preventDefault();


  /*
    One press = one shared LASSO command.

    Later:

      phone button
            ↓
        COMMANDS.LASSO
            ↓
       physical rope
            ↓
        Death Chili

    Glasses short-pinch will send this SAME command.
  */

  emitCommand(
    COMMANDS.LASSO,
    {
      source:
        "phone-button",

      pointerType:
        event.pointerType
    }
  );


  // -------------------------------------------------------
  // SMALL HAPTIC FEEDBACK
  // -------------------------------------------------------

  try {

    navigator.vibrate?.(
      18
    );

  }

  catch {
    // Vibration is optional.
  }

}


// =========================================================
// SPRINT START
// =========================================================

function handleSprintStart(
  event
) {

  if (
    isXRPresenting()
  ) {

    return;

  }


  event.preventDefault();


  sprintPointerId =
    event.pointerId;


  try {

    sprintButton.setPointerCapture(
      event.pointerId
    );

  }

  catch {
    // Not fatal.
  }


  setSprint(
    true,
    "phone"
  );


  sprintButton?.classList.add(
    "active"
  );

}


// =========================================================
// SPRINT END
// =========================================================

function handleSprintEnd(
  event
) {

  if (
    sprintPointerId !== null

    &&

    event.pointerId !==
      sprintPointerId
  ) {

    return;

  }


  event.preventDefault();


  try {

    if (
      sprintButton?.hasPointerCapture(
        event.pointerId
      )
    ) {

      sprintButton.releasePointerCapture(
        event.pointerId
      );

    }

  }

  catch {
    // Not fatal.
  }


  sprintPointerId =
    null;


  setSprint(
    false,
    "phone"
  );


  sprintButton?.classList.remove(
    "active"
  );

}


// =========================================================
// LOST SPRINT POINTER
// =========================================================

function handleSprintLostCapture(
  event
) {

  if (
    sprintPointerId !== null

    &&

    event.pointerId !==
      sprintPointerId
  ) {

    return;

  }


  sprintPointerId =
    null;


  setSprint(
    false,
    "phone"
  );


  sprintButton?.classList.remove(
    "active"
  );

}


// =========================================================
// RESET PHONE INPUT
// =========================================================

export function resetPhoneInput() {

  joystickPointerId =
    null;


  joystickActive =
    false;


  sprintPointerId =
    null;


  setSprint(
    false,
    "phone-reset"
  );


  stopMovement(
    "phone-reset"
  );


  sprintButton?.classList.remove(
    "active"
  );


  resetJoystickVisual();

}


// =========================================================
// PHONE UPDATE
//
// Phone input is currently event-driven.
//
// We keep updatePhoneInput() so main.js can use the same
// update structure for:
//
// phone
// head
// hands
// Chili
// =========================================================

export function updatePhoneInput(
  deltaTime
) {

  void deltaTime;

}


// =========================================================
// UTILITY
// =========================================================

function preventDefault(
  event
) {

  event.preventDefault();

}