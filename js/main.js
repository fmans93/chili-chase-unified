// =========================================================
// CHILI CHASE // UNIFIED
// main.js
//
// TARGETS:
//   PHONE
//   META / XR GLASSES
//
// STARTUP:
//
// PHONE:
//   START GAME
//
// GLASSES:
//   ENABLE HEAD CONTROL
//        ↓
//   gyro/head pointer
//        ↓
//   dwell START GAME
//        ↓
//   ENTER AR
//        ↓
//   Meta pinch/hold controls
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
  recenterHead,
  isHeadControlEnabled
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

  headEnabled: false,

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


const enableHeadButton =
  document.getElementById(
    "enable-head"
  );


const headStartMessage =
  document.getElementById(
    "head-start-message"
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
// BOOT
// =========================================================

async function boot() {

  try {

    showLoading(
      "PREPARING CHILI CHASE..."
    );


    // -----------------------------------------------------
    // SCENE
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
    // COMMANDS
    // -----------------------------------------------------

    setupCommands();


    // -----------------------------------------------------
    // XR LIFECYCLE
    // -----------------------------------------------------

    setupXRLifecycle();


    // -----------------------------------------------------
    // LOAD CHILI
    // -----------------------------------------------------

    await loadDeathChili();


    // -----------------------------------------------------
    // UI
    // -----------------------------------------------------

    updatePlayerHUD();

    updateScoreHUD();

    updateStatusUI();


    // -----------------------------------------------------
    // PHONE / NORMAL START
    // -----------------------------------------------------

    startButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startGame();
});

startButton.addEventListener("click", (event) => {
  event.preventDefault();
  startGame();
});


    // -----------------------------------------------------
    // GLASSES HEAD START
    //
    // IMPORTANT:
    //
    // Motion permission comes directly from this physical
    // user interaction, matching the known-good glasses
    // implementation.
    // -----------------------------------------------------

    enableHeadButton?.addEventListener(
      "click",
      enableHeadStartup
    );


    GAME.initialized =
      true;


    hideLoading();


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
// ENABLE GLASSES HEAD CONTROL
//
// This happens BEFORE game start.
//
// That is the key startup correction.
// =========================================================

async function enableHeadStartup() {

  if (!GAME.initialized) {
    return;
  }


  // If head control is already running,
  // just recenter and enter the game.
  if (isHeadControlEnabled()) {

    recenterHead();

    GAME.headEnabled = true;

    setDeviceMode("glasses");

    updateStatusUI();

    await startGame();

    return;
  }


  // -------------------------------------------------------
  // ENABLE BUTTON FEEDBACK
  // -------------------------------------------------------

  if (enableHeadButton) {

    enableHeadButton.disabled = true;

    enableHeadButton.textContent =
      "ENABLING...";

  }


  setHeadStartupMessage(
    "REQUESTING MOTION CONTROL..."
  );


  // -------------------------------------------------------
  // REQUEST MOTION PERMISSION
  //
  // This is the part already confirmed working
  // on your glasses.
  // -------------------------------------------------------

  const enabled =
    await enableGlassesHead();


  // -------------------------------------------------------
  // FAILED
  // -------------------------------------------------------

  if (!enabled) {

    if (enableHeadButton) {

      enableHeadButton.disabled = false;

      enableHeadButton.textContent =
        "ENABLE HEAD CONTROL";

    }


    setHeadStartupMessage(
      "HEAD CONTROL FAILED — TRY AGAIN"
    );


    return;
  }


  // =======================================================
  // SUCCESS
  // =======================================================

  GAME.headEnabled = true;


  setDeviceMode(
    "glasses"
  );


  updateStatusUI();


  if (enableHeadButton) {

    enableHeadButton.textContent =
      "HEAD CONTROL ONLINE";

  }


  setHeadStartupMessage(
    "HEAD CONTROL ONLINE"
  );


  logConfig(
    "Glasses head control enabled. Starting game."
  );


  // =======================================================
  // IMPORTANT
  //
  // DO NOT WAIT FOR ANOTHER START BUTTON.
  //
  // The working glasses reference dismissed its startup
  // overlay immediately after head control was enabled.
  //
  // We do the equivalent here by entering our existing
  // game-start path immediately.
  // =======================================================

  await startGame();

}


// =========================================================
// START GAME
//
// Phone:
//     tap START
//
// Glasses:
//     head pointer dwells on START
//     -> glasses-head.js calls button.click()
//     -> this exact same function runs.
//
// Therefore we maintain ONE game-start path.
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
  // PHONE SENSOR PATH
  //
  // If head control wasn't already enabled from the
  // glasses startup button, START may still request motion
  // permission on devices that expose DeviceOrientation.
  //
  // Failure is not fatal.
  // -------------------------------------------------------

  if (
    !isHeadControlEnabled() &&
    CAPABILITIES.orientation
  ) {

    try {

      const enabled =
        await enableGlassesHead();


      if (enabled) {

        GAME.headEnabled =
          true;

      }

    }

    catch (error) {

      warnConfig(
        "Orientation control unavailable:",
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
      GAME.headEnabled
    ) {

      setDeviceMode(
        "glasses"
      );

    }

    else if (
      CAPABILITIES.mobileLike
    ) {

      setDeviceMode(
        "phone"
      );

    }

  }


  // -------------------------------------------------------
  // HIDE START
  // -------------------------------------------------------

  startScreen?.classList.add(
    "hidden"
  );


  // -------------------------------------------------------
  // SHOW HUD
  // -------------------------------------------------------

  hud?.classList.remove(
    "hidden"
  );


  GAME.clock.start();

  GAME.clock.getDelta();


  showGameMessage(
    "FIND THE CHILI"
  );


  updateStatusUI();


  logConfig(
    "Game started.",
    {
      headControl:
        isHeadControlEnabled(),

      mode:
        GAME.headEnabled
          ? "glasses"
          : "phone"
    }
  );

}


// =========================================================
// GAME LOOP
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
  // NORMAL DELTA
  // -------------------------------------------------------

  else {

    GAME.lastXRFrameTime =
      0;


    deltaTime =
      GAME.clock.getDelta();

  }


  deltaTime =
    THREE.MathUtils.clamp(
      deltaTime || 0,
      0,
      0.05
    );


  // =======================================================
  // CRITICAL:
  //
  // HEAD CONTROL MUST UPDATE BEFORE GAME START.
  //
  // Otherwise the glasses could never use the pointer to
  // dwell-select START GAME.
  // =======================================================

  updateGlassesHead(
    deltaTime
  );


  // -------------------------------------------------------
  // GAME UPDATE
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

    updateChili(
      deltaTime
    );

  }


  renderer.render(
    scene,
    camera
  );

}


// =========================================================
// GAME UPDATE
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
  // XR HANDS
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
  // XR locomotion remains inside glasses-hands.js.
  // -------------------------------------------------------

  if (
    !XR_STATE.presenting
  ) {

    updatePhoneMovement(
      deltaTime
    );

  }


  // -------------------------------------------------------
  // NON-XR LOOK
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
    Math.abs(x) < 0.001 &&
    Math.abs(z) < 0.001
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
// NON-XR LOOK
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
// COMMANDS
// =========================================================

function setupCommands() {

  // -------------------------------------------------------
  // SHARED LASSO
  //
  // Phone LASSO
  // Meta short pinch
  // Head dwell LASSO
  //
  // all arrive here.
  // -------------------------------------------------------

  onCommand(
    COMMANDS.LASSO,
    handleLassoCommand
  );


  onCommand(
    COMMANDS.RECENTER,
    () => {

      logConfig(
        "RECENTER command received."
      );

    }
  );

}


// =========================================================
// TEMPORARY LASSO FEEDBACK
//
// We still have NOT built the final physical rope.
//
// This only verifies that the shared action reached the
// game.
// =========================================================

function handleLassoCommand(event) {

  logConfig(
    "LASSO COMMAND:",
    event.detail
  );


  showGameMessage(
    "LASSO!"
  );


  if (
    !CHILI.loaded
  ) {

    return;

  }


  if (
    CHILI.actions?.attack
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


// =========================================================
// XR LIFECYCLE
// =========================================================

function setupXRLifecycle() {

  onXRSessionStart(
    () => {

      GAME.lastXRFrameTime =
        0;


      GAME.started =
        true;


      startScreen?.classList.add(
        "hidden"
      );


      hud?.classList.remove(
        "hidden"
      );


      setDeviceMode(
        "xr"
      );


      updateStatusUI();


      /*
        Wait until the XR runtime has begun providing its
        camera pose before positioning Chili.
      */

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
        "XR gameplay session started."
      );

    }
  );


  onXRSessionEnd(
    () => {

      GAME.lastXRFrameTime =
        0;


      resetPhoneInput();


      if (
        GAME.headEnabled
      ) {

        setDeviceMode(
          "glasses"
        );

      }

      else if (
        CAPABILITIES.mobileLike
      ) {

        setDeviceMode(
          "phone"
        );

      }


      updateStatusUI();


      showGameMessage(
        "AR ENDED"
      );

    }
  );

}


// =========================================================
// PLACE CHILI IN FRONT OF CURRENT PLAYER
// =========================================================

function placeChiliInFrontOfPlayer(
  distance = 4.5
) {

  if (
    !CHILI.holder
  ) {

    return;

  }


  getCameraWorldPosition(
    tempCameraPosition
  );


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


  tempSpawnWorld.copy(
    tempCameraPosition
  );


  tempSpawnWorld.addScaledVector(
    tempForward,
    distance
  );


  tempSpawnWorld.y =
    0;


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
    "Chili placed in front of player:",
    {
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
  );

}


// =========================================================
// HEAD START MESSAGE
// =========================================================

function setHeadStartupMessage(
  message
) {

  if (
    headStartMessage
  ) {

    headStartMessage.textContent =
      message;

  }

}


// =========================================================
// PLAYER HUD
// =========================================================

function updatePlayerHUD() {

  const healthText =

    document.getElementById(
      "health-value"
    )

    ||

    document.getElementById(
      "player-health"
    )

    ||

    document.getElementById(
      "health-text"
    );


  if (
    healthText
  ) {

    healthText.textContent =
      `${GAME.playerHealth} / ${CONFIG.PLAYER.MAX_HEALTH}`;

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
// LOADING
// =========================================================

function showLoading(message) {

  GAME.loading =
    true;


  loadingScreen?.classList.remove(
    "hidden"
  );


  const text =

    document.getElementById(
      "loading-message"
    )

    ||

    loadingScreen?.querySelector(
      ".loading-text"
    );


  if (
    text
  ) {

    text.textContent =
      message;

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
// ERROR
// =========================================================

function showError(message) {

  errorScreen?.classList.remove(
    "hidden"
  );


  const text =

    document.getElementById(
      "error-message"
    )

    ||

    errorScreen?.querySelector(
      ".error-text"
    );


  if (
    text
  ) {

    text.textContent =
      message;

  }


  console.error(
    "[CHILI CHASE]",
    message
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