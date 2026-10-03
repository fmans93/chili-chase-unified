// =========================================================
// CHILI CHASE // UNIFIED
// main.js
//
// GOLD BUILD RESET
//
// Based on the startup behavior of the proven
// Rodeo Ranger Soldier Build.
//
// TARGETS:
//   PHONE
//   META / XR GLASSES
//
// IMPORTANT:
//   START GAME MUST ALWAYS START THE GAME.
//   NO capability check blocks START.
//   NO gyro request blocks START.
//   NO XR check blocks START.
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

  headEnabled: false,

  clock:
    new THREE.Clock(),

  lastXRFrameTime:
    0,

  playerHealth:
    CONFIG.PLAYER.MAX_HEALTH,

  score:
    0,

  tokens:
    0

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
// START BUTTON
//
// IMPORTANT:
//
// Attach START immediately.
//
// This mirrors the known-good Soldier Build.
// =========================================================

startButton?.addEventListener(
  "pointerdown",
  startGame
);

startButton?.addEventListener(
  "click",
  startGame
);


// =========================================================
// START FAILSAFE
//
// Proven Soldier Build used the same idea.
//
// If the browser somehow fails to deliver the button event,
// don't leave the player trapped forever.
// =========================================================

window.setTimeout(
  () => {

    if (
      GAME.initialized &&
      !GAME.started
    ) {

      logConfig(
        "START failsafe activated."
      );

      startGame();

    }

  },
  3000
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
    // GLASSES HEAD BUTTON
    // -----------------------------------------------------

    enableHeadButton?.addEventListener(
      "click",
      enableHeadStartup
    );


    // -----------------------------------------------------
    // GAME IS NOW ALLOWED TO START
    //
    // Do this BEFORE:
    // - capability detection
    // - model loading
    //
    // Those systems cannot trap START anymore.
    // -----------------------------------------------------

    GAME.initialized =
      true;


    hideLoading();


    // -----------------------------------------------------
    // START RENDER LOOP NOW
    // -----------------------------------------------------

    renderer.setAnimationLoop(
      gameLoop
    );


    // -----------------------------------------------------
    // CAPABILITY DETECTION
    //
    // FIRE AND FORGET.
    // DO NOT await.
    // -----------------------------------------------------

    detectCapabilities()

      .then(
        () => {

          try {

            updateStatusUI();

          }

          catch (error) {

            warnConfig(
              "Status UI update failed:",
              error
            );

          }


          logConfig(
            "Capability detection complete."
          );

        }
      )

      .catch(
        error => {

          warnConfig(
            "Capability detection failed. Continuing:",
            error
          );

        }
      );


    // -----------------------------------------------------
    // LOAD CHILI
    //
    // This also must NOT control whether START works.
    // -----------------------------------------------------

    loadDeathChili()

      .then(
        () => {

          logConfig(
            "Zombie Chili ready."
          );

        }
      )

      .catch(
        error => {

          warnConfig(
            "Zombie Chili failed to load:",
            error
          );

          showGameMessage(
            "CHILI MODEL ERROR",
            2200
          );

        }
      );


    // -----------------------------------------------------
    // HUD
    // -----------------------------------------------------

    updatePlayerHUD();

    updateScoreHUD();


    logConfig(
      "CHILI CHASE GOLD startup ready."
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
// THIS IS INTENTIONALLY SIMPLE.
//
// It follows the proven Soldier Build:
//
// started = true
// hide start screen
// start clock
// play
//
// NO await.
// NO gyro permission.
// NO XR detection.
// NO model loading.
// =========================================================

function startGame(event) {

  event?.preventDefault?.();


  if (
    GAME.started
  ) {

    return;

  }


  if (
    !GAME.initialized
  ) {

    logConfig(
      "START pressed before initialization finished."
    );

    return;

  }


  // -------------------------------------------------------
  // START
  // -------------------------------------------------------

  GAME.started =
    true;


  // -------------------------------------------------------
  // REMOVE START SCREEN IMMEDIATELY
  // -------------------------------------------------------

  if (
    startScreen
  ) {

    startScreen.style.display =
      "none";

  }


  // -------------------------------------------------------
  // SHOW HUD
  // -------------------------------------------------------

  hud?.classList.remove(
    "hidden"
  );


  // -------------------------------------------------------
  // DEFAULT DEVICE MODE
  //
  // Head control is NOT requested here.
  // -------------------------------------------------------

  if (
    !XR_STATE.presenting
  ) {

    setDeviceMode(
      GAME.headEnabled
        ? "glasses"
        : "phone"
    );

  }


  // -------------------------------------------------------
  // CLOCK
  // -------------------------------------------------------

  GAME.clock.start();

  GAME.clock.getDelta();


  // -------------------------------------------------------
  // MESSAGE
  // -------------------------------------------------------

  showGameMessage(
    "CHILI HUNT ONLINE"
  );


  try {

    updateStatusUI();

  }

  catch (error) {

    warnConfig(
      "Status UI update failed:",
      error
    );

  }


  logConfig(
    "GAME STARTED.",
    {
      xr:
        XR_STATE.presenting,

      head:
        GAME.headEnabled
    }
  );

}


// =========================================================
// ENABLE GLASSES HEAD CONTROL
//
// Separate path.
//
// Phone START never enters this function.
// =========================================================

async function enableHeadStartup() {

  if (
    !GAME.initialized
  ) {

    return;

  }


  if (
    isHeadControlEnabled()
  ) {

    GAME.headEnabled =
      true;

    recenterHead();

    setDeviceMode(
      "glasses"
    );


    setHeadStartupMessage(
      "HEAD CONTROL ONLINE"
    );


    startGame();

    return;

  }


  if (
    enableHeadButton
  ) {

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


    if (
      !enabled
    ) {

      if (
        enableHeadButton
      ) {

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


    if (
      enableHeadButton
    ) {

      enableHeadButton.textContent =
        "HEAD CONTROL ONLINE";

    }


    setHeadStartupMessage(
      "HEAD CONTROL ONLINE"
    );


    logConfig(
      "Glasses head control online."
    );


    // Same game-start path.
    startGame();

  }

  catch (error) {

    warnConfig(
      "Head control error:",
      error
    );


    if (
      enableHeadButton
    ) {

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
  // GLASSES HEAD
  //
  // Keep running before game starts so glasses UI can use
  // head control.
  // -------------------------------------------------------

  updateGlassesHead(
    deltaTime
  );


  // -------------------------------------------------------
  // GAME
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


  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

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
  // XR HAND INPUT
  //
  // This module contains the proven short-pinch / hold
  // architecture transplanted from Soldier Build.
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
  // -------------------------------------------------------

  if (
    !XR_STATE.presenting
  ) {

    updatePhoneMovement(
      deltaTime
    );

  }


  // -------------------------------------------------------
  // PHONE LOOK
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
// LOOK INPUT
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
  // LASSO
  //
  // Phone button + Meta short pinch eventually share this.
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

      recenterHead();


      showGameMessage(
        "RECENTERED"
      );


      logConfig(
        "RECENTER command received."
      );

    }
  );

}


// =========================================================
// TEMP LASSO TEST
//
// We are NOT building the final rope yet.
//
// First goal:
// prove START + phone + glasses are stable again.
// =========================================================

function handleLassoCommand(
  event
) {

  logConfig(
    "LASSO COMMAND:",
    event?.detail
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


      // ---------------------------------------------------
      // XR SESSION MEANS GAME IS ACTIVE
      // ---------------------------------------------------

      GAME.started =
        true;


      if (
        startScreen
      ) {

        startScreen.style.display =
          "none";

      }


      hud?.classList.remove(
        "hidden"
      );


      setDeviceMode(
        "xr"
      );


      try {

        updateStatusUI();

      }

      catch (error) {

        warnConfig(
          "XR status update failed:",
          error
        );

      }


      // ---------------------------------------------------
      // POSITION CHILI
      // ---------------------------------------------------

      requestAnimationFrame(
        () => {

          placeChiliInFrontOfPlayer(
            4.5
          );

        }
      );


      showGameMessage(
        "AR ACTIVE"
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

      else {

        setDeviceMode(
          "phone"
        );

      }


      try {

        updateStatusUI();

      }

      catch (error) {

        warnConfig(
          "XR status update failed:",
          error
        );

      }


      showGameMessage(
        "AR ENDED"
      );

    }
  );

}


// =========================================================
// PLACE CHILI IN FRONT OF PLAYER
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
    "Chili placed:",
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


  if (
    !element
  ) {

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