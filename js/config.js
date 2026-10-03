// =========================================================
// CHILI CHASE // UNIFIED
// config.js
//
// Central configuration for the entire game.
// Change gameplay tuning here instead of scattering
// numbers throughout the project.
// =========================================================

export const CONFIG = {

  // =======================================================
  // PROJECT
  // =======================================================

  VERSION: "UNIFIED-V1",

  DEBUG: true,


  // =======================================================
  // ASSETS
  // =======================================================

  ASSETS: {

    // Our first V1 enemy.
    DEATH_CHILI:
      "./assets/chilideath.glb"

  },


  // =======================================================
  // PLAYER
  // =======================================================

  PLAYER: {

    MAX_HEALTH: 100,

    // Normal virtual movement.
    MOVE_SPEED: 4.6,

    // Sprint movement.
    SPRINT_SPEED: 7.0,

    // Desktop mouse sensitivity.
    MOUSE_SENSITIVITY: 0.0022

  },


  // =======================================================
  // CHILI
  // =======================================================

  CHILI: {

    /*
      IMPORTANT:

      We are NOT going to trust whatever scale happens
      to be stored inside the GLB.

      chili.js will measure the model and normalize it
      to this real-world height.

      This is based on the model-normalization approach
      that behaved better in the older builds.
    */

    TARGET_HEIGHT: 1.45,

    /*
      Initial desktop position.

      X = left/right
      Y = floor
      Z = forward/back

      Negative Z is in front of the default camera.
    */

    START_POSITION: {
      x: 0,
      y: 0,
      z: -4.5
    },

    WALK_SPEED: 1.7,

    RUN_SPEED: 2.7,

    ATTACK_RANGE: 1.55,

    ATTACK_DAMAGE: 15,

    ATTACK_COOLDOWN: 1700

  },


  // =======================================================
  // CAMERA
  // =======================================================

  CAMERA: {

    FOV: 70,

    NEAR: 0.01,

    FAR: 100,

    /*
      Desktop eye height.

      XR ignores this because the headset/device
      controls the physical camera pose.
    */

    DESKTOP_HEIGHT: 1.65

  },


  // =======================================================
  // WORLD
  // =======================================================

  WORLD: {

    /*
      Temporary desktop floor.

      In immersive AR, the real world becomes the
      visible environment instead.
    */

    FLOOR_SIZE: 30,

    SHOW_TEST_GRID: true

  },


  // =======================================================
  // PHONE INPUT
  // =======================================================

  PHONE: {

    JOYSTICK_RADIUS: 42,

    LOOK_SENSITIVITY: 0.004,

    SPRINT_MULTIPLIER: 1.5

  },


  // =======================================================
  // GLASSES / HEAD GYRO
  // =======================================================

  HEAD: {

    /*
      These values come from the behavior that worked
      well in our Ray-Ban gyro test.
    */

    SENSITIVITY_X: 7,

    /*
      We are keeping this configurable because the
      vertical axis behaved differently during testing.

      glasses-head.js will be the only module responsible
      for translating the sensor orientation into our
      normalized game input.
    */

    SENSITIVITY_Y: -7,

    SMOOTHING: 0.15,

    MAX_SCREEN_X: 0.44,

    MAX_SCREEN_Y: 0.40,

    DWELL_TIME: 1000

  },


  // =======================================================
  // XR HAND INPUT
  // =======================================================

  HANDS: {

    /*
      Proven interaction idea:

      Short pinch/select:
          action

      Hold:
          movement/control
    */

    HOLD_THRESHOLD: 210,

    FORWARD_SPEED: 5.0,

    BACKWARD_SPEED: 3.6,

    TURN_SPEED: 2.15,

    MOVEMENT_BOOST: 1.35,

    TURN_DEADZONE: 0.035,

    MOVE_DEADZONE: 0.025

  },


  // =======================================================
  // LASSO
  // =======================================================

  /*
    V1 only exposes the action.

    The full physical rope/wrangling system comes after
    our AR + phone + glasses baseline is proven.
  */

  LASSO: {

    RANGE: 9,

    COOLDOWN: 650

  },


  // =======================================================
  // XR / AR
  // =======================================================

  XR: {

    REQUIRED_FEATURES: [
      "local-floor"
    ],

    OPTIONAL_FEATURES: [
      "dom-overlay",
      "hand-tracking",
      "hit-test"
    ]

  }

};


// =========================================================
// DEVELOPMENT HELPERS
// =========================================================

export function logConfig(...args) {

  if (!CONFIG.DEBUG) {
    return;
  }

  console.log(
    "%c[CHILI CHASE]",
    "color:#00ff88;font-weight:bold;",
    ...args
  );

}


export function warnConfig(...args) {

  if (!CONFIG.DEBUG) {
    return;
  }

  console.warn(
    "[CHILI CHASE]",
    ...args
  );

}