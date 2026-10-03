// =========================================================
// CHILI CHASE // UNIFIED
// main.js
//
// TARGETS:
//   PHONE
//   META / XR GLASSES
//
// PHONE:
//   START GAME -> immediate gameplay
//
// GLASSES:
//   ENABLE HEAD CONTROL
//        ↓
//   gyro/head pointer
//        ↓
//   START GAME
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

  clock: new THREE.Clock(),

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
    // IMPORTANT:
    // ATTACH START BUTTON IMMEDIATELY
    //
    // The phone START button must not depend on:
    // - XR detection
    // - gyro detection
    // - model loading
    // -----------------------------------------------------

    startButton?.addEventListener(
      "pointerdown",
      handleStartPress
    );

    startButton?.addEventListener(
      "click",
      handleStartPress
    );


    // -----------------------------------------------------
    // CAPABILITIES
    //
    // NON-BLOCKING
    // -----------------------------------------------------

    detectCapabilities()

      .then(() => {

        updateStatusUI();

        logConfig(
          "Capability detection complete."
        );

      })

      .catch((error) => {

        warnConfig(
          "Capability detection failed — continuing anyway:",
          error
        );

      });


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
    // GLASSES HEAD START
    // -----------------------------------------------------

    enableHeadButton?.addEventListener(
      "click",
      enableHeadStartup
    );


    // -----------------------------------------------------
    // ALLOW START
    //
    // Do this BEFORE waiting for Chili model.
    // -----------------------------------------------------

    GAME.initialized = true;

    hideLoading();

    renderer.setAnimationLoop(
      gameLoop
    );


    // -----------------------------------------------------
    // LOAD CHILI
    //
    // Failure to load Chili should NOT trap the user
    // on the start screen.
    // -----------------------------------------------------

    try {

      await loadDeathChili();

      logConfig(
        "Death Chili loaded."
      );

    }

    catch (error) {

      warnConfig(
        "Chili model failed to load. Game will continue:",
        error
      );

    }


    // -----------------------------------------------------
    // UI
    // -----------------------------------------------------

    updatePlayerHUD();

    updateScoreHUD();

    updateStatusUI();


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
// START BUTTON
// =========================================================

function handleStartPress(event) {

  event?.preventDefault();

  startGame();

}


// =========================================================
// ENABLE GLASSES HEAD CONTROL
// =========================================================

async function enableHeadStartup() {

  if (!GAME.initialized) {

    return;

  }


  if (isHeadControlEnabled()) {

    recenterHead();

    GAME.headEnabled = true;

    setDeviceMode(
      "glasses"
    );

    updateStatusUI();

    startGame();

    return;

  }


  if (enableHeadButton) {

    enableHeadButton.disabled =
      true;

    enableHeadButton.textContent =
      "ENABLING...";

  }


  setHeadStartupMessage(
    "REQUESTING MOTION CONTROL..."
  );


  try {

    const enabled =
      await enableGlassesHead();


    if (!enabled) {

      if (enableHeadButton) {

        enableHeadButton.disabled =
          false;

        enableHeadButton.textContent =
          "ENABLE HEAD CONTROL";

      }

      setHeadStartupMessage(
        "HEAD CONTROL FAILED — TRY AGAIN"
      );

      return;

    }


    GAME.headEnabled =
      true;

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
      "Glasses head control enabled."
    );


    startGame();

  }

  catch (error) {

    warnConfig(
      "Could not enable glasses head control:",
      error
    );


    if (enableHeadButton) {

      enableHeadButton.disabled =
        false;

      enableHeadButton.textContent =
        "ENABLE HEAD CONTROL";

    }


    setHeadStartupMessage(
      "HEAD CONTROL FAILED — TRY AGAIN"
    );

  }

}


// =========================================================
// START GAME
//
// CRITICAL CHANGE:
//
// PHONE START DOES NOT REQUEST GYRO/HEAD PERMISSION.
//
// Glasses head control is ONLY enabled through
// enableHeadStartup().
//
// This prevents phones with DeviceOrientation support from
// getting trapped on the START screen.
// =========================================================

function startGame() {

  if (
    !GAME.initialized ||
    GAME.started
  ) {

    return;

  }


  // -------------------------------------------------------
  // MARK STARTED
  // -------------------------------------------------------

  GAME.started =
    true;


  // -------------------------------------------------------
  // HIDE START IMMEDIATELY
  //
  // Nothing asynchronous happens before this.
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


  // -------------------------------------------------------
  // DEVICE MODE
  // -------------------------------------------------------

  if (!XR_STATE.presenting) {

    if (GAME.headEnabled) {

      setDeviceMode(
        "glasses"
      );

    }

    else {

      setDeviceMode(
        "phone"
      );

    }

  }


  // -------------------------------------------------------
  // CLOCK
  // -------------------------------------------------------

  GAME.clock.start();

  GAME.clock.getDelta();


  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // HEAD CONTROL
  //
  // This still updates before game start so the glasses
  // head pointer can operate the startup UI.
  // -------------------------------------------------------

  updateGlassesHead(
    deltaTime
  );


  // -------------------------------------------------------
  // GAME UPDATE
  // -------------------------------------------------------

  if (GAME.started) {

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
  // PHONE INPUT
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
  // Keep normal phone/browser movement here.
  // Phone-in-XR movement will be handled after the basic
  // phone startup is confirmed working.
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

  onCommand(
    COMMANDS.LASSO,
    handleLassoCommand
  );


  onCommand(
    COMMANDS.RECENTER,
    () => {

      recenterHead();

      logConfig(
        "RECENTER command received."
      );

    }
  );

}


// =========================================================
// TEMPORARY LASSO FEEDBACK
// =========================================================

function handleLassoCommand(event) {

  logConfig(
    "LASSO COMMAND:",
    event?.detail
  );


  showGameMessage(
    "LASSO!"
  );


  if (!CHILI.loaded) {

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


      // Wait one normal frame so XR has a chance to provide
      // its camera pose before placing Chili.

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

      else {

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

function showLoading(
  message
) {

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

function showError(
  message
) {

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