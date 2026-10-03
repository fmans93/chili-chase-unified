// =========================================================
// CHILI CHASE // UNIFIED
// main.js
//
// UNIFIED V1 BOOTSTRAP
//
// TARGET DEVICES:
//   - Phone
//   - Meta / XR glasses
//
// Connects:
//   Scene
//   Death Chili
//   Phone controls
//   Glasses gyro/head controls
//   Meta hand/pinch controls
//   WebXR
//   Shared input
//   Animation loop
//
// The laptop is NOT a gameplay target.
// =========================================================

import * as THREE from "three";

import {
  CONFIG,
  logConfig,
  warnConfig
} from "./config.js";

import {
  createScene,
  scene,
  camera,
  renderer,
  movePlayer,
  rotateDesktopCamera,
  getCameraWorldPosition,
  getFlatCameraForward,
  WORLD_ROOT
} from "./core/scene.js";

import {
  CAPABILITIES,
  detectCapabilities,
  setDeviceMode,
  updateStatusUI
} from "./core/capabilities.js";

import {
  initializeXR,
  XR_STATE,
  onXRSessionStart,
  onXRSessionEnd
} from "./core/xr.js";

import {
  initializeInputManager,
  INPUT,
  COMMANDS,
  onCommand,
  consumeLook
} from "./input/input-manager.js";

import {
  initializePhoneInput,
  updatePhoneInput,
  resetPhoneInput
} from "./input/phone-input.js";

import {
  initializeGlassesHead,
  enableGlassesHead,
  updateGlassesHead,
  recenterHead
} from "./input/glasses-head.js";

import {
  initializeGlassesHands,
  updateGlassesHands
} from "./input/glasses-hands.js";

import {
  loadDeathChili,
  updateChili,
  CHILI,
  playChiliAnimation
} from "./game/chili.js";


// =========================================================
// GAME STATE
// =========================================================

const GAME = {

  initialized: false,

  started: false,

  loading: false,

  clock:
    new THREE.Clock(),

  lastXRFrameTime: 0,

  playerHealth:
    CONFIG.PLAYER.MAX_HEALTH,

  score: 0,

  tokens: 0

};


// =========================================================
// TEMP OBJECTS
// =========================================================

const tempCameraPosition =
  new THREE.Vector3();

const tempForward =
  new THREE.Vector3();

const tempSpawnWorld =
  new THREE.Vector3();


// =========================================================
// DOM
// =========================================================

const startScreen =
  document.getElementById(
    "start-screen"
  );

const startButton =
  document.getElementById(
    "start-game"
  );

const hud =
  document.getElementById(
    "hud"
  );

const loadingScreen =
  document.getElementById(
    "loading-screen"
  );

const errorScreen =
  document.getElementById(
    "error-screen"
  );


// =========================================================
// BOOT
// =========================================================

boot();


// =========================================================
// INITIAL BOOT
// =========================================================

async function boot() {

  try {

    showLoading(
      "PREPARING CHILI CHASE..."
    );


    // -----------------------------------------------------
    // SCENE FIRST
    // -----------------------------------------------------

    createScene();


    // -----------------------------------------------------
    // CAPABILITIES
    // -----------------------------------------------------

    await detectCapabilities();


    // -----------------------------------------------------
    // INPUT
    // -----------------------------------------------------

    initializeInputManager();

    initializePhoneInput();

    initializeGlassesHead();

    initializeGlassesHands();


    // -----------------------------------------------------
    // XR
    // -----------------------------------------------------

    initializeXR();


    // -----------------------------------------------------
    // GAME COMMANDS
    // -----------------------------------------------------

    setupCommands();


    // -----------------------------------------------------
    // XR LIFECYCLE
    // -----------------------------------------------------

    setupXRLifecycle();


    // -----------------------------------------------------
    // DEATH CHILI
    // -----------------------------------------------------

    await loadDeathChili();


    // -----------------------------------------------------
    // INITIAL UI
    // -----------------------------------------------------

    updatePlayerHUD();

    updateScoreHUD();

    updateStatusUI();


    // -----------------------------------------------------
    // START BUTTON
    // -----------------------------------------------------

    if (
      startButton
    ) {

      startButton.addEventListener(
        "click",
        startGame
      );

    }


    GAME.initialized =
      true;


    hideLoading();


    /*
      Start rendering now.

      The game remains behind the START screen until the
      user physically presses START.
    */

    renderer.setAnimationLoop(
      gameLoop
    );


    logConfig(
      "CHILI CHASE unified V1 ready."
    );

  }

  catch (error) {

    console.error(
      "[CHILI CHASE] BOOT ERROR:",
      error
    );


    hideLoading();


    showError(
      error?.message ||
      "Could not initialize Chili Chase."
    );

  }

}


// =========================================================
// START GAME
//
// IMPORTANT:
//
// This comes from a physical user press.
//
// That makes it the correct place to request sensor
// permission when the browser requires a user gesture.
// =========================================================

async function startGame() {

  if (
    !GAME.initialized ||
    GAME.started
  ) {

    return;

  }


  GAME.started =
    true;


  // -------------------------------------------------------
  // HEAD / GYRO
  //
  // If DeviceOrientation exists, attempt to enable it.
  //
  // Failure is NOT fatal because the phone game should
  // still run even if gyro permission isn't available.
  // -------------------------------------------------------

  if (
    CAPABILITIES.orientation
  ) {

    try {

      await enableGlassesHead();

    }

    catch (error) {

      warnConfig(
        "Head control could not be enabled:",
        error
      );

    }

  }


  // -------------------------------------------------------
  // DEVICE MODE
  // -------------------------------------------------------

  if (
    !XR_STATE.presenting
  ) {

    if (
      CAPABILITIES.mobileLike
    ) {

      setDeviceMode(
        "phone"
      );

    }

  }


  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  startScreen?.classList.add(
    "hidden"
  );


  if (
    hud
  ) {

    hud.classList.remove(
      "hidden"
    );

  }


  showGameMessage(
    "FIND THE CHILI"
  );


  /*
    Start/reset the game clock here so loading time doesn't
    create a huge first-frame delta.
  */

  GAME.clock.start();

  GAME.clock.getDelta();


  logConfig(
    "Game started."
  );

}


// =========================================================
// GAME LOOP
//
// THREE's setAnimationLoop works for BOTH:
//
// normal browser rendering
//
// and
//
// WebXR rendering.
//
// During XR, Three passes:
//   time
//   XRFrame
// =========================================================

function gameLoop(
  time,
  frame
) {

  if (
    !renderer ||
    !scene ||
    !camera
  ) {

    return;

  }


  let deltaTime;


  // -------------------------------------------------------
  // XR DELTA
  // -------------------------------------------------------

  if (
    frame &&
    XR_STATE.presenting
  ) {

    if (
      GAME.lastXRFrameTime ===
      0
    ) {

      deltaTime =
        1 / 72;

    }

    else {

      deltaTime =

        (
          time -
          GAME.lastXRFrameTime
        )

        /
        1000;

    }


    GAME.lastXRFrameTime =
      time;

  }

  // -------------------------------------------------------
  // NORMAL BROWSER DELTA
  // -------------------------------------------------------

  else {

    GAME.lastXRFrameTime =
      0;


    deltaTime =
      GAME.clock.getDelta();

  }


  // -------------------------------------------------------
  // PROTECT AGAINST GIANT DELTAS
  //
  // Browser tab changes, debugging pauses, etc.
  // -------------------------------------------------------

  deltaTime =
    THREE.MathUtils.clamp(
      deltaTime || 0,
      0,
      0.05
    );


  // -------------------------------------------------------
  // UPDATE ONLY AFTER START
  // -------------------------------------------------------

  if (
    GAME.started
  ) {

    updateGame(
      deltaTime,
      frame
    );

  }

  else {

    /*
      Chili animations may still idle behind the start
      screen.
    */

    updateChili(
      deltaTime
    );

  }


  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  renderer.render(
    scene,
    camera
  );

}


// =========================================================
// UPDATE GAME
// =========================================================

function updateGame(
  deltaTime,
  frame
) {

  // -------------------------------------------------------
  // PHONE
  // -------------------------------------------------------

  updatePhoneInput(
    deltaTime
  );


  // -------------------------------------------------------
  // GLASSES HEAD / GYRO
  // -------------------------------------------------------

  updateGlassesHead(
    deltaTime
  );


  // -------------------------------------------------------
  // META XR HANDS
  //
  // This receives the REAL XRFrame.
  // -------------------------------------------------------

  if (
    frame &&
    XR_STATE.presenting
  ) {

    updateGlassesHands(
      frame,
      deltaTime
    );

  }


  // -------------------------------------------------------
  // PHONE MOVEMENT
  //
  // Do NOT apply shared joystick movement while XR is
  // presenting.
  //
  // Glasses movement is handled by glasses-hands.js using
  // the proven XR WORLD_ROOT shifting behavior.
  // -------------------------------------------------------

  if (
    !XR_STATE.presenting
  ) {

    updatePhoneMovement(
      deltaTime
    );

  }


  // -------------------------------------------------------
  // LOOK INPUT
  //
  // This remains available for future phone touch-look.
  // We do not use it to override an XR headset camera.
  // -------------------------------------------------------

  updateLookInput();


  // -------------------------------------------------------
  // CHILI
  // -------------------------------------------------------

  updateChili(
    deltaTime
  );

}


// =========================================================
// PHONE MOVEMENT
// =========================================================

function updatePhoneMovement(
  deltaTime
) {

  const x =
    INPUT.moveX;


  const z =
    INPUT.moveZ;


  if (
    Math.abs(x) <
      0.001

    &&

    Math.abs(z) <
      0.001
  ) {

    return;

  }


  const speed =

    INPUT.sprint

      ? CONFIG.PLAYER.SPRINT_SPEED

      : CONFIG.PLAYER.MOVE_SPEED;


  movePlayer(
    x,
    z,
    speed,
    deltaTime
  );

}


// =========================================================
// LOOK INPUT
//
// Right now this mostly stays dormant.
//
// We keep the shared route ready so phone touch-look can
// later feed the exact same game architecture.
//
// NEVER rotate the XR camera manually.
// =========================================================

function updateLookInput() {

  const look =
    consumeLook();


  if (
    XR_STATE.presenting
  ) {

    return;

  }


  if (
    look.x === 0 &&
    look.y === 0
  ) {

    return;

  }


  rotateDesktopCamera(
    -look.x,
    -look.y
  );

}


// =========================================================
// SHARED GAME COMMANDS
// =========================================================

function setupCommands() {

  // -------------------------------------------------------
  // LASSO
  //
  // BOTH:
  //
  // phone button
  //
  // and
  //
  // Meta short pinch
  //
  // arrive HERE.
  //
  // V1 only proves the shared command path.
  // The next major system will replace this with the
  // physical rope/lasso mechanic.
  // -------------------------------------------------------

  onCommand(
    COMMANDS.LASSO,
    handleLassoCommand
  );


  // -------------------------------------------------------
  // RECENTER
  // -------------------------------------------------------

  onCommand(
    COMMANDS.RECENTER,
    () => {

      /*
        glasses-head.js already recenters when its button
        is pressed.

        Keeping this command subscription means other
        devices can request the same behavior later.
      */

      logConfig(
        "RECENTER command received."
      );

    }
  );

}


// =========================================================
// TEMPORARY V1 LASSO COMMAND
//
// IMPORTANT:
//
// We are NOT building the fake line/raycast lasso from the
// rough prototype.
//
// This is only feedback proving:
//
// PHONE LASSO BUTTON
//
//             and
//
// META SHORT PINCH
//
// both successfully reach the same gameplay command.
//
// The actual physical lasso comes next.
// =========================================================

function handleLassoCommand(
  event
) {

  logConfig(
    "LASSO COMMAND RECEIVED:",
    event.detail
  );


  showGameMessage(
    "LASSO!"
  );


  // -------------------------------------------------------
  // SMALL CHILI REACTION
  //
  // If an attack animation exists, briefly use it as
  // visible proof that the action path fired.
  //
  // This is temporary and NOT our final lasso behavior.
  // -------------------------------------------------------

  if (
    CHILI.loaded
  ) {

    if (
      CHILI.actions["attack"]
    ) {

      playChiliAnimation(
        "attack",
        0.08
      );


      window.setTimeout(
        () => {

          if (
            CHILI.loaded
          ) {

            playChiliAnimation(
              "idle",
              0.15
            );

          }

        },
        500
      );

    }

  }

}


// =========================================================
// XR LIFECYCLE
// =========================================================

function setupXRLifecycle() {

  // -------------------------------------------------------
  // XR START
  // -------------------------------------------------------

  onXRSessionStart(
    async () => {

      GAME.lastXRFrameTime =
        0;


      /*
        If the user entered AR before pressing START,
        treat the XR interaction as entering the actual
        game.
      */

      if (
        !GAME.started
      ) {

        GAME.started =
          true;


        startScreen?.classList.add(
          "hidden"
        );


        hud?.classList.remove(
          "hidden"
        );

      }


      /*
        Recenter gyro/head HUD when possible.

        We don't force it if sensor readings haven't arrived
        yet.
      */

      recenterHead();


      // ---------------------------------------------------
      // PLACE CHILI IN FRONT OF PLAYER
      //
      // This copies the useful behavior from the old
      // working AR build: don't trust a fixed world Z after
      // entering AR.
      //
      // Instead place Chili relative to the CURRENT XR
      // camera.
      // ---------------------------------------------------

      requestAnimationFrame(
        () => {

          placeChiliInFrontOfPlayer(
            4.5
          );

        }
      );


      showGameMessage(
        "AR READY"
      );


      logConfig(
        "Unified game received XR session start."
      );

    }
  );


  // -------------------------------------------------------
  // XR END
  // -------------------------------------------------------

  onXRSessionEnd(
    () => {

      GAME.lastXRFrameTime =
        0;


      resetPhoneInput();


      showGameMessage(
        "AR ENDED"
      );

    }
  );

}


// =========================================================
// PLACE CHILI IN FRONT OF PLAYER
//
// Critical for AR.
//
// Fixed:
//
//     Chili.position.z = -4.5
//
// is unreliable because the user's XR origin/orientation
// may not match our assumed desktop world.
//
// Instead:
//
//     current camera
//          ↓
//     flatten forward
//          ↓
//     4.5 meters ahead
//          ↓
//     floor Y = 0
// =========================================================

function placeChiliInFrontOfPlayer(
  distance = 4.5
) {

  if (
    !CHILI.holder
  ) {

    return;

  }


  // -------------------------------------------------------
  // CAMERA WORLD POSITION
  // -------------------------------------------------------

  getCameraWorldPosition(
    tempCameraPosition
  );


  // -------------------------------------------------------
  // CAMERA FLAT FORWARD
  // -------------------------------------------------------

  getFlatCameraForward(
    tempForward
  );


  if (
    tempForward.lengthSq() <
    0.000001
  ) {

    tempForward.set(
      0,
      0,
      -1
    );

  }


  tempForward.normalize();


  // -------------------------------------------------------
  // WORLD TARGET
  // -------------------------------------------------------

  tempSpawnWorld.copy(
    tempCameraPosition
  );


  tempSpawnWorld.addScaledVector(
    tempForward,
    distance
  );


  /*
    local-floor means floor level should be Y=0.
  */

  tempSpawnWorld.y =
    0;


  // -------------------------------------------------------
  // CHILI IS CHILD OF WORLD_ROOT
  //
  // Convert desired WORLD position into WORLD_ROOT's local
  // coordinates before assigning holder.position.
  // -------------------------------------------------------

  WORLD_ROOT.updateMatrixWorld(
    true
  );


  WORLD_ROOT.worldToLocal(
    tempSpawnWorld
  );


  CHILI.holder.position.copy(
    tempSpawnWorld
  );


  logConfig(
    "Death Chili placed in front of player:",
    {
      distance,

      position: {
        x:
          Number(
            CHILI.holder.position.x.toFixed(2)
          ),

        y:
          Number(
            CHILI.holder.position.y.toFixed(2)
          ),

        z:
          Number(
            CHILI.holder.position.z.toFixed(2)
          )
      }
    }
  );

}


// =========================================================
// PLAYER HUD
// =========================================================

function updatePlayerHUD() {

  /*
    Support a few likely IDs so the HUD isn't fragile while
    we're building.
  */

  const healthText =

    document.getElementById(
      "health-value"
    )

    ||

    document.getElementById(
      "player-health"
    );


  if (
    healthText
  ) {

    healthText.textContent =
      `${GAME.playerHealth}`;

  }


  const healthFill =

    document.getElementById(
      "health-fill"
    );


  if (
    healthFill
  ) {

    const percent =

      THREE.MathUtils.clamp(

        GAME.playerHealth /
        CONFIG.PLAYER.MAX_HEALTH,

        0,

        1

      )

      *

      100;


    healthFill.style.width =
      `${percent}%`;

  }

}


// =========================================================
// SCORE HUD
// =========================================================

function updateScoreHUD() {

  const score =

    document.getElementById(
      "score-value"
    )

    ||

    document.getElementById(
      "score"
    );


  if (
    score
  ) {

    score.textContent =
      `${GAME.score}`;

  }


  const tokens =

    document.getElementById(
      "token-value"
    )

    ||

    document.getElementById(
      "tokens"
    );


  if (
    tokens
  ) {

    tokens.textContent =
      `${GAME.tokens}`;

  }

}


// =========================================================
// LOADING UI
// =========================================================

function showLoading(
  message
) {

  GAME.loading =
    true;


  if (
    loadingScreen
  ) {

    loadingScreen.classList.remove(
      "hidden"
    );


    const text =

      loadingScreen.querySelector(
        ".loading-text"
      )

      ||

      loadingScreen.querySelector(
        "[data-loading-text]"
      );


    if (
      text
    ) {

      text.textContent =
        message;

    }

  }

}


// =========================================================
// HIDE LOADING
// =========================================================

function hideLoading() {

  GAME.loading =
    false;


  loadingScreen?.classList.add(
    "hidden"
  );

}


// =========================================================
// ERROR UI
// =========================================================

function showError(
  message
) {

  if (
    errorScreen
  ) {

    errorScreen.classList.remove(
      "hidden"
    );


    const text =

      errorScreen.querySelector(
        ".error-text"
      )

      ||

      errorScreen.querySelector(
        "[data-error-text]"
      );


    if (
      text
    ) {

      text.textContent =
        message;

    }

  }


  showGameMessage(
    message,
    5000
  );

}


// =========================================================
// GAME MESSAGE
// =========================================================

function showGameMessage(
  text,
  duration = 1400
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
    showGameMessage.timeout
  );


  showGameMessage.timeout =
    window.setTimeout(
      () => {

        element.classList.remove(
          "show"
        );

      },
      duration
    );

}