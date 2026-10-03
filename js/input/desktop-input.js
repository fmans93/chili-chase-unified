// =========================================================
// CHILI CHASE // UNIFIED
// input/desktop-input.js
//
// Desktop development controls:
//
// W / S       Forward / backward
// A / D       Strafe
// Shift       Sprint
// Mouse       Look
// Click       Lasso
// Space       Lasso
//
// Desktop controls are primarily for fast VS Code testing.
// =========================================================

import {
  CONFIG,
  logConfig
} from "../config.js";

import {
  setMovement,
  setSprint,
  addLookDelta,
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

const keys = {

  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false

};


let initialized = false;

let mouseLookEnabled = false;


// =========================================================
// INITIALIZE
// =========================================================

export function initializeDesktopInput() {

  if (initialized) {
    return;
  }


  initialized = true;


  // -------------------------------------------------------
  // KEYBOARD
  // -------------------------------------------------------

  window.addEventListener(
    "keydown",
    handleKeyDown
  );


  window.addEventListener(
    "keyup",
    handleKeyUp
  );


  // -------------------------------------------------------
  // MOUSE
  // -------------------------------------------------------

  const canvas =
    document.querySelector(
      "#game-container canvas"
    );


  if (canvas) {

    /*
      Clicking the game canvas enables mouse-look.

      We use pointer lock so you can keep turning without
      the mouse reaching the side of the browser.
    */

    canvas.addEventListener(
      "click",
      handleCanvasClick
    );

  }


  document.addEventListener(
    "pointerlockchange",
    handlePointerLockChange
  );


  document.addEventListener(
    "mousemove",
    handleMouseMove
  );


  // -------------------------------------------------------
  // SAFETY
  // -------------------------------------------------------

  window.addEventListener(
    "blur",
    resetDesktopState
  );


  logConfig(
    "Desktop input initialized."
  );

}


// =========================================================
// KEY DOWN
// =========================================================

function handleKeyDown(
  event
) {

  /*
    When immersive XR is active, keyboard controls should
    not fight our XR/glasses input.
  */

  if (
    isXRPresenting()
  ) {

    return;

  }


  switch (
    event.code
  ) {

    case "KeyW":

    case "ArrowUp":

      keys.forward =
        true;

      break;


    case "KeyS":

    case "ArrowDown":

      keys.backward =
        true;

      break;


    case "KeyA":

    case "ArrowLeft":

      keys.left =
        true;

      break;


    case "KeyD":

    case "ArrowRight":

      keys.right =
        true;

      break;


    case "ShiftLeft":

    case "ShiftRight":

      if (
        !keys.sprint
      ) {

        keys.sprint =
          true;


        setSprint(
          true,
          "desktop"
        );

      }

      break;


    case "Space":

      /*
        Prevent the browser from scrolling or activating
        a focused button.
      */

      event.preventDefault();


      /*
        Ignore keyboard auto-repeat.

        One physical press = one lasso command.
      */

      if (
        !event.repeat
      ) {

        emitCommand(
          COMMANDS.LASSO,
          {
            source:
              "desktop-keyboard"
          }
        );

      }

      break;

  }


  updateMovement();

}


// =========================================================
// KEY UP
// =========================================================

function handleKeyUp(
  event
) {

  switch (
    event.code
  ) {

    case "KeyW":

    case "ArrowUp":

      keys.forward =
        false;

      break;


    case "KeyS":

    case "ArrowDown":

      keys.backward =
        false;

      break;


    case "KeyA":

    case "ArrowLeft":

      keys.left =
        false;

      break;


    case "KeyD":

    case "ArrowRight":

      keys.right =
        false;

      break;


    case "ShiftLeft":

    case "ShiftRight":

      keys.sprint =
        false;


      setSprint(
        false,
        "desktop"
      );

      break;

  }


  updateMovement();

}


// =========================================================
// UPDATE MOVEMENT
// =========================================================

function updateMovement() {

  if (
    isXRPresenting()
  ) {

    return;

  }


  let x = 0;

  let z = 0;


  // -------------------------------------------------------
  // FORWARD / BACK
  // -------------------------------------------------------

  if (
    keys.forward
  ) {

    z += 1;

  }


  if (
    keys.backward
  ) {

    z -= 1;

  }


  // -------------------------------------------------------
  // LEFT / RIGHT
  // -------------------------------------------------------

  if (
    keys.right
  ) {

    x += 1;

  }


  if (
    keys.left
  ) {

    x -= 1;

  }


  /*
    Normalize diagonals.

    W + D should not move 41% faster than W alone.
  */

  const length =
    Math.hypot(
      x,
      z
    );


  if (
    length > 1
  ) {

    x /=
      length;


    z /=
      length;

  }


  setMovement(
    x,
    z,
    "desktop"
  );

}


// =========================================================
// CANVAS CLICK
// =========================================================

function handleCanvasClick(
  event
) {

  if (
    isXRPresenting()
  ) {

    return;

  }


  const canvas =
    event.currentTarget;


  /*
    FIRST CLICK:

    Capture mouse for camera control.

    Once pointer lock is active, later left clicks can
    become gameplay actions.
  */

  if (
    document.pointerLockElement !==
    canvas
  ) {

    canvas.requestPointerLock?.();

    return;

  }


  // -------------------------------------------------------
  // TEMPORARY LASSO ACTION
  // -------------------------------------------------------

  emitCommand(
    COMMANDS.LASSO,
    {
      source:
        "desktop-mouse"
    }
  );

}


// =========================================================
// POINTER LOCK CHANGE
// =========================================================

function handlePointerLockChange() {

  const canvas =
    document.querySelector(
      "#game-container canvas"
    );


  mouseLookEnabled =

    Boolean(canvas)

    &&

    document.pointerLockElement ===
      canvas;


  logConfig(
    "Desktop mouse look:",
    mouseLookEnabled
      ? "ON"
      : "OFF"
  );

}


// =========================================================
// MOUSE LOOK
// =========================================================

function handleMouseMove(
  event
) {

  if (
    !mouseLookEnabled
  ) {

    return;

  }


  if (
    isXRPresenting()
  ) {

    return;

  }


  const x =

    event.movementX *
    CONFIG.PLAYER.MOUSE_SENSITIVITY;


  const y =

    event.movementY *
    CONFIG.PLAYER.MOUSE_SENSITIVITY;


  addLookDelta(
    x,
    y,
    "desktop-mouse"
  );

}


// =========================================================
// RESET DESKTOP INPUT
// =========================================================

function resetDesktopState() {

  keys.forward =
    false;


  keys.backward =
    false;


  keys.left =
    false;


  keys.right =
    false;


  keys.sprint =
    false;


  setSprint(
    false,
    "desktop"
  );


  stopMovement(
    "desktop-reset"
  );

}


// =========================================================
// UPDATE
//
// Kept here so every input module can eventually have the
// same lifecycle:
//
// initialize()
// update()
//
// Desktop input is event-driven, so it currently doesn't
// need per-frame calculations.
// =========================================================

export function updateDesktopInput() {

  // Intentionally empty for V1.

}