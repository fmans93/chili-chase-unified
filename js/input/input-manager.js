// =========================================================
// CHILI CHASE // UNIFIED
// input/input-manager.js
//
// ONE shared input language for the entire game.
//
// Input devices:
//   Desktop keyboard/mouse
//   Phone touch/joystick
//   Glasses gyro/head
//   XR hands/pinch
//
// all feed into:
//
//              INPUT
//
// Gameplay does NOT need to know which device produced
// the command.
// =========================================================

import {
  logConfig
} from "../config.js";


// =========================================================
// SHARED INPUT STATE
// =========================================================

export const INPUT = {

  // -------------------------------------------------------
  // MOVEMENT
  //
  // x:
  //   -1 = left
  //    0 = none
  //   +1 = right
  //
  // z:
  //   -1 = backward
  //    0 = none
  //   +1 = forward
  // -------------------------------------------------------

  moveX: 0,

  moveZ: 0,

  sprint: false,


  // -------------------------------------------------------
  // LOOK
  //
  // Primarily used by desktop/phone.
  //
  // XR headset orientation itself is controlled by the
  // XR runtime.
  // -------------------------------------------------------

  lookX: 0,

  lookY: 0,


  // -------------------------------------------------------
  // HEAD / GYRO
  //
  // Used for our glasses-style pointer/HUD.
  // -------------------------------------------------------

  headX: 0,

  headY: 0,

  headYaw: 0,

  headPitch: 0,

  headActive: false,


  // -------------------------------------------------------
  // XR HAND / RAY
  // -------------------------------------------------------

  handActive: false,

  handHeld: false,

  handX: 0,

  handY: 0,


  // -------------------------------------------------------
  // CURRENT INPUT SOURCE
  // -------------------------------------------------------

  source: "none"

};


// =========================================================
// GAME COMMANDS
//
// These are discrete actions.
//
// Examples:
//
// phone LASSO button
// mouse click
// space bar
// glasses short pinch
//
// can ALL call:
//
//     emitCommand("LASSO")
//
// The gameplay lasso system only listens for LASSO.
// =========================================================

export const COMMANDS = Object.freeze({

  LASSO:
    "LASSO",

  THROW_TACO:
    "THROW_TACO",

  TAKE_TACO:
    "TAKE_TACO",

  INTERACT:
    "INTERACT",

  RECENTER:
    "RECENTER",

  SPRINT_START:
    "SPRINT_START",

  SPRINT_END:
    "SPRINT_END"

});


// =========================================================
// COMMAND LISTENERS
// =========================================================

const commandListeners =
  new Map();


// =========================================================
// INPUT CHANGE LISTENERS
//
// Useful later for:
// - HUD
// - debugging
// - tutorials
// - analytics
// =========================================================

const inputListeners =
  new Set();


// =========================================================
// INITIALIZE
// =========================================================

export function initializeInputManager() {

  resetInput();


  logConfig(
    "Shared input manager initialized."
  );

}


// =========================================================
// SET MOVEMENT
// =========================================================

export function setMovement(
  x,
  z,
  source = "unknown"
) {

  INPUT.moveX =
    clampAxis(
      x
    );


  INPUT.moveZ =
    clampAxis(
      z
    );


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// SET LOOK
// =========================================================

export function setLook(
  x,
  y,
  source = "unknown"
) {

  INPUT.lookX =
    Number.isFinite(x)
      ? x
      : 0;


  INPUT.lookY =
    Number.isFinite(y)
      ? y
      : 0;


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// ADD LOOK DELTA
//
// Mouse and touch-look usually produce deltas rather than
// absolute values.
// =========================================================

export function addLookDelta(
  x,
  y,
  source = "unknown"
) {

  if (
    Number.isFinite(x)
  ) {

    INPUT.lookX +=
      x;

  }


  if (
    Number.isFinite(y)
  ) {

    INPUT.lookY +=
      y;

  }


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// CONSUME LOOK
//
// main.js can call this once per frame.
//
// The returned values are then reset.
//
// This prevents mouse/touch deltas from continuously
// rotating the camera forever.
// =========================================================

export function consumeLook() {

  const result = {

    x:
      INPUT.lookX,

    y:
      INPUT.lookY

  };


  INPUT.lookX =
    0;


  INPUT.lookY =
    0;


  return result;

}


// =========================================================
// SET SPRINT
// =========================================================

export function setSprint(
  active,
  source = "unknown"
) {

  const next =
    Boolean(
      active
    );


  if (
    INPUT.sprint ===
    next
  ) {

    return;

  }


  INPUT.sprint =
    next;


  INPUT.source =
    source;


  emitCommand(

    next
      ? COMMANDS.SPRINT_START
      : COMMANDS.SPRINT_END,

    {
      source
    }

  );


  notifyInputChanged();

}


// =========================================================
// SET HEAD INPUT
// =========================================================

export function setHeadInput({

  x = 0,

  y = 0,

  yaw = 0,

  pitch = 0,

  active = true,

  source = "head"

} = {}) {

  INPUT.headX =
    Number.isFinite(x)
      ? x
      : 0;


  INPUT.headY =
    Number.isFinite(y)
      ? y
      : 0;


  INPUT.headYaw =
    Number.isFinite(yaw)
      ? yaw
      : 0;


  INPUT.headPitch =
    Number.isFinite(pitch)
      ? pitch
      : 0;


  INPUT.headActive =
    Boolean(
      active
    );


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// CLEAR HEAD INPUT
// =========================================================

export function clearHeadInput() {

  INPUT.headX =
    0;


  INPUT.headY =
    0;


  INPUT.headYaw =
    0;


  INPUT.headPitch =
    0;


  INPUT.headActive =
    false;


  notifyInputChanged();

}


// =========================================================
// SET HAND INPUT
// =========================================================

export function setHandInput({

  x = 0,

  y = 0,

  active = true,

  held = false,

  source = "xr-hand"

} = {}) {

  INPUT.handX =
    Number.isFinite(x)
      ? x
      : 0;


  INPUT.handY =
    Number.isFinite(y)
      ? y
      : 0;


  INPUT.handActive =
    Boolean(
      active
    );


  INPUT.handHeld =
    Boolean(
      held
    );


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// CLEAR HAND INPUT
// =========================================================

export function clearHandInput() {

  INPUT.handX =
    0;


  INPUT.handY =
    0;


  INPUT.handActive =
    false;


  INPUT.handHeld =
    false;


  notifyInputChanged();

}


// =========================================================
// EMIT GAME COMMAND
// =========================================================

export function emitCommand(
  command,
  detail = {}
) {

  if (!command) {
    return;
  }


  const normalized =
    String(command)
      .toUpperCase();


  logConfig(
    "COMMAND:",
    normalized,
    detail
  );


  const listeners =
    commandListeners.get(
      normalized
    );


  if (!listeners) {
    return;
  }


  for (
    const callback
    of listeners
  ) {

    try {

      callback({

        command:
          normalized,

        detail,

        time:
          performance.now()

      });

    }

    catch (error) {

      console.error(
        `[CHILI CHASE] Command listener failed: ${normalized}`,
        error
      );

    }

  }

}


// =========================================================
// LISTEN FOR COMMAND
//
// Example:
//
// onCommand(
//   COMMANDS.LASSO,
//   () => {
//     throwLasso();
//   }
// );
//
// Returns an unsubscribe function.
// =========================================================

export function onCommand(
  command,
  callback
) {

  if (
    !command ||
    typeof callback !==
      "function"
  ) {

    return () => {};

  }


  const normalized =
    String(command)
      .toUpperCase();


  if (
    !commandListeners.has(
      normalized
    )
  ) {

    commandListeners.set(

      normalized,

      new Set()

    );

  }


  const listeners =
    commandListeners.get(
      normalized
    );


  listeners.add(
    callback
  );


  return () => {

    listeners.delete(
      callback
    );


    if (
      listeners.size ===
      0
    ) {

      commandListeners.delete(
        normalized
      );

    }

  };

}


// =========================================================
// LISTEN FOR GENERAL INPUT CHANGES
// =========================================================

export function onInputChanged(
  callback
) {

  if (
    typeof callback !==
    "function"
  ) {

    return () => {};

  }


  inputListeners.add(
    callback
  );


  return () => {

    inputListeners.delete(
      callback
    );

  };

}


// =========================================================
// NOTIFY INPUT LISTENERS
// =========================================================

function notifyInputChanged() {

  for (
    const callback
    of inputListeners
  ) {

    try {

      callback(
        INPUT
      );

    }

    catch (error) {

      console.error(
        "[CHILI CHASE] Input listener failed:",
        error
      );

    }

  }

}


// =========================================================
// RESET MOVEMENT ONLY
//
// Useful when:
// - touch ends
// - XR hand disappears
// - browser loses focus
// =========================================================

export function stopMovement(
  source = "system"
) {

  INPUT.moveX =
    0;


  INPUT.moveZ =
    0;


  INPUT.sprint =
    false;


  INPUT.source =
    source;


  notifyInputChanged();

}


// =========================================================
// FULL RESET
// =========================================================

export function resetInput() {

  INPUT.moveX =
    0;


  INPUT.moveZ =
    0;


  INPUT.sprint =
    false;


  INPUT.lookX =
    0;


  INPUT.lookY =
    0;


  INPUT.headX =
    0;


  INPUT.headY =
    0;


  INPUT.headYaw =
    0;


  INPUT.headPitch =
    0;


  INPUT.headActive =
    false;


  INPUT.handX =
    0;


  INPUT.handY =
    0;


  INPUT.handActive =
    false;


  INPUT.handHeld =
    false;


  INPUT.source =
    "none";


  notifyInputChanged();

}


// =========================================================
// GET MOVEMENT VECTOR
// =========================================================

export function getMovement() {

  return {

    x:
      INPUT.moveX,

    z:
      INPUT.moveZ,

    sprint:
      INPUT.sprint

  };

}


// =========================================================
// GET HEAD STATE
// =========================================================

export function getHeadInput() {

  return {

    x:
      INPUT.headX,

    y:
      INPUT.headY,

    yaw:
      INPUT.headYaw,

    pitch:
      INPUT.headPitch,

    active:
      INPUT.headActive

  };

}


// =========================================================
// GET HAND STATE
// =========================================================

export function getHandInput() {

  return {

    x:
      INPUT.handX,

    y:
      INPUT.handY,

    active:
      INPUT.handActive,

    held:
      INPUT.handHeld

  };

}


// =========================================================
// AXIS CLAMP
// =========================================================

function clampAxis(
  value
) {

  if (
    !Number.isFinite(
      value
    )
  ) {

    return 0;

  }


  return Math.max(

    -1,

    Math.min(
      1,
      value
    )

  );

}


// =========================================================
// SAFETY
//
// If browser focus disappears, don't leave the player
// sprinting into a wall.
// =========================================================

window.addEventListener(
  "blur",
  () => {

    stopMovement(
      "window-blur"
    );

  }
);


document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.hidden
    ) {

      stopMovement(
        "page-hidden"
      );

    }

  }
);