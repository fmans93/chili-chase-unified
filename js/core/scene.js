// =========================================================
// CHILI CHASE // UNIFIED
// core/scene.js
//
// Creates:
// - Three.js scene
// - Camera
// - WebGL renderer
// - XR-enabled renderer
// - Movable world root
// - Lighting
// - Desktop test floor/grid
//
// IMPORTANT:
// In XR, the headset owns the camera.
// Player locomotion will move WORLD_ROOT instead.
// =========================================================

import * as THREE from "three";

import {
  CONFIG,
  logConfig
} from "../config.js";


// =========================================================
// SHARED SCENE OBJECTS
// =========================================================

export let scene = null;

export let camera = null;

export let renderer = null;

/*
  Everything belonging to the game world should eventually
  live inside WORLD_ROOT.

  This is extremely important for glasses/headset movement.

  Instead of forcing the XR camera to move:

      camera.position += movement

  we can move the entire game world in the opposite
  direction:

      WORLD_ROOT.position -= movement

  This preserves the XR headset's physical tracking.
*/

export let WORLD_ROOT = null;


// Desktop-only visual helpers.

let desktopFloor = null;

let gridHelper = null;


// =========================================================
// TEMPORARY VECTORS
//
// Reusing these prevents unnecessary object creation
// every frame later.
// =========================================================

const tempForward = new THREE.Vector3();

const tempRight = new THREE.Vector3();

const tempMove = new THREE.Vector3();


// =========================================================
// INITIALIZE SCENE
// =========================================================

export function createScene() {

  logConfig("Creating Three.js scene...");


  // -------------------------------------------------------
  // SCENE
  // -------------------------------------------------------

  scene = new THREE.Scene();

  /*
    This background is visible during desktop development.

    During immersive AR the device camera becomes the
    background, so the virtual background will not replace
    the real world.
  */

  scene.background = new THREE.Color(0x07100b);


  // -------------------------------------------------------
  // CAMERA
  // -------------------------------------------------------

  camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    window.innerWidth / window.innerHeight,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );


  /*
    Desktop camera starts at approximately standing eye
    height.

    XR will replace this view with the physical headset /
    phone pose.
  */

  camera.position.set(
    0,
    CONFIG.CAMERA.DESKTOP_HEIGHT,
    0
  );


  camera.rotation.order = "YXZ";


  // -------------------------------------------------------
  // WORLD ROOT
  // -------------------------------------------------------

  WORLD_ROOT = new THREE.Group();

  WORLD_ROOT.name = "CHILI_WORLD_ROOT";

  scene.add(WORLD_ROOT);


  // -------------------------------------------------------
  // LIGHTING
  // -------------------------------------------------------

  createLighting();


  // -------------------------------------------------------
  // DESKTOP TEST ENVIRONMENT
  // -------------------------------------------------------

  createDesktopEnvironment();


  // -------------------------------------------------------
  // RENDERER
  // -------------------------------------------------------

  renderer = new THREE.WebGLRenderer({

    antialias: true,

    alpha: true,

    powerPreference: "high-performance"

  });


  renderer.setPixelRatio(

    Math.min(
      window.devicePixelRatio || 1,
      2
    )

  );


  renderer.setSize(

    window.innerWidth,

    window.innerHeight

  );


  /*
    Modern Three.js color management.
  */

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  /*
    GLB models often look much better with tone mapping
    enabled.
  */

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


  renderer.toneMappingExposure = 1.15;


  /*
    REQUIRED for WebXR.
  */

  renderer.xr.enabled = true;


  // -------------------------------------------------------
  // CANVAS
  // -------------------------------------------------------

  const container =
    document.getElementById("game-container");


  if (!container) {

    throw new Error(
      "Could not find #game-container."
    );

  }


  container.innerHTML = "";

  container.appendChild(
    renderer.domElement
  );


  // -------------------------------------------------------
  // WINDOW RESIZE
  // -------------------------------------------------------

  window.addEventListener(
    "resize",
    handleResize
  );


  logConfig(
    "Scene created.",
    {
      WebGL: true,
      XRRenderer: renderer.xr.enabled
    }
  );


  return {

    scene,

    camera,

    renderer,

    WORLD_ROOT

  };

}


// =========================================================
// LIGHTING
// =========================================================

function createLighting() {

  // -------------------------------------------------------
  // HEMISPHERE LIGHT
  // -------------------------------------------------------

  const hemisphere =
    new THREE.HemisphereLight(
      0xffffff,
      0x28352b,
      2.0
    );


  hemisphere.name =
    "WORLD_HEMISPHERE_LIGHT";


  scene.add(
    hemisphere
  );


  // -------------------------------------------------------
  // DIRECTIONAL LIGHT
  // -------------------------------------------------------

  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      2.4
    );


  sun.position.set(
    4,
    8,
    5
  );


  sun.name =
    "WORLD_DIRECTIONAL_LIGHT";


  scene.add(
    sun
  );


  // -------------------------------------------------------
  // FILL LIGHT
  // -------------------------------------------------------

  const fill =
    new THREE.DirectionalLight(
      0xffb48a,
      0.65
    );


  fill.position.set(
    -5,
    3,
    -4
  );


  fill.name =
    "WORLD_FILL_LIGHT";


  scene.add(
    fill
  );

}


// =========================================================
// DESKTOP TEST ENVIRONMENT
// =========================================================

function createDesktopEnvironment() {

  /*
    This floor is only here so desktop testing has a visual
    reference.

    We will hide it when immersive AR begins.
  */

  const floorGeometry =
    new THREE.PlaneGeometry(
      CONFIG.WORLD.FLOOR_SIZE,
      CONFIG.WORLD.FLOOR_SIZE
    );


  const floorMaterial =
    new THREE.MeshStandardMaterial({

      color: 0x101713,

      roughness: 1,

      metalness: 0

    });


  desktopFloor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );


  desktopFloor.rotation.x =
    -Math.PI / 2;


  desktopFloor.position.y = 0;


  desktopFloor.name =
    "DESKTOP_TEST_FLOOR";


  WORLD_ROOT.add(
    desktopFloor
  );


  // -------------------------------------------------------
  // GRID
  // -------------------------------------------------------

  if (
    CONFIG.WORLD.SHOW_TEST_GRID
  ) {

    gridHelper =
      new THREE.GridHelper(
        CONFIG.WORLD.FLOOR_SIZE,
        CONFIG.WORLD.FLOOR_SIZE,
        0x00aa66,
        0x24402f
      );


    gridHelper.position.y =
      0.003;


    gridHelper.name =
      "DESKTOP_TEST_GRID";


    WORLD_ROOT.add(
      gridHelper
    );

  }

}


// =========================================================
// DESKTOP ENVIRONMENT VISIBILITY
// =========================================================

export function setDesktopEnvironmentVisible(
  visible
) {

  if (desktopFloor) {

    desktopFloor.visible =
      visible;

  }


  if (gridHelper) {

    gridHelper.visible =
      visible;

  }

}


// =========================================================
// WINDOW RESIZE
// =========================================================

function handleResize() {

  if (
    !camera ||
    !renderer
  ) {

    return;

  }


  camera.aspect =
    window.innerWidth /
    window.innerHeight;


  camera.updateProjectionMatrix();


  renderer.setSize(

    window.innerWidth,

    window.innerHeight

  );

}


// =========================================================
// GET CAMERA FOR CURRENT MODE
// =========================================================

export function getActiveCamera() {

  if (
    renderer &&
    renderer.xr.isPresenting
  ) {

    /*
      renderer.xr.getCamera(camera) returns the XR camera
      hierarchy representing the current headset/device
      view.
    */

    return renderer.xr.getCamera(
      camera
    );

  }


  return camera;

}


// =========================================================
// CAMERA WORLD POSITION
// =========================================================

export function getCameraWorldPosition(
  target = new THREE.Vector3()
) {

  const activeCamera =
    getActiveCamera();


  activeCamera.getWorldPosition(
    target
  );


  return target;

}


// =========================================================
// CAMERA FORWARD DIRECTION
// =========================================================

export function getCameraForward(
  target = new THREE.Vector3()
) {

  const activeCamera =
    getActiveCamera();


  activeCamera.getWorldDirection(
    target
  );


  return target.normalize();

}


// =========================================================
// FLAT CAMERA FORWARD
//
// Removes vertical pitch.
//
// Used for walking:
//
// Looking upward should not make the player fly upward.
// =========================================================

export function getFlatCameraForward(
  target = new THREE.Vector3()
) {

  getCameraForward(
    target
  );


  target.y = 0;


  if (
    target.lengthSq() <
    0.000001
  ) {

    target.set(
      0,
      0,
      -1
    );

  }


  return target.normalize();

}


// =========================================================
// CAMERA RIGHT DIRECTION
// =========================================================

export function getFlatCameraRight(
  target = new THREE.Vector3()
) {

  getFlatCameraForward(
    tempForward
  );


  /*
    Cross forward with world-up to produce camera-right.
  */

  target
    .crossVectors(
      tempForward,
      camera.up
    )
    .normalize();


  return target;

}


// =========================================================
// MOVE PLAYER
//
// x = strafe
// z = forward/back
//
// Positive z means forward.
//
// Desktop:
//     Move camera.
//
// XR:
//     Move WORLD_ROOT opposite player motion.
//
// This preserves the locomotion behavior that worked in
// our glasses prototype.
// =========================================================

export function movePlayer(
  x,
  z,
  speed,
  deltaTime
) {

  if (
    !camera ||
    !WORLD_ROOT
  ) {

    return;

  }


  getFlatCameraForward(
    tempForward
  );


  getFlatCameraRight(
    tempRight
  );


  tempMove.set(
    0,
    0,
    0
  );


  // Forward / backward.

  tempMove.addScaledVector(
    tempForward,
    z
  );


  // Left / right.

  tempMove.addScaledVector(
    tempRight,
    x
  );


  /*
    Prevent diagonal movement from becoming faster.
  */

  if (
    tempMove.lengthSq() >
    1
  ) {

    tempMove.normalize();

  }


  tempMove.multiplyScalar(
    speed * deltaTime
  );


  // -------------------------------------------------------
  // XR MOVEMENT
  // -------------------------------------------------------

  if (
    renderer.xr.isPresenting
  ) {

    /*
      The XR runtime controls the physical camera.

      So if the player wants to move +X/+Z through the
      game world, move the virtual world in the opposite
      direction.
    */

    WORLD_ROOT.position.x -=
      tempMove.x;


    WORLD_ROOT.position.z -=
      tempMove.z;


    return;

  }


  // -------------------------------------------------------
  // DESKTOP MOVEMENT
  // -------------------------------------------------------

  camera.position.x +=
    tempMove.x;


  camera.position.z +=
    tempMove.z;

}


// =========================================================
// ROTATE DESKTOP PLAYER
//
// Used by mouse/keyboard testing.
//
// XR rotation will be handled separately because physical
// head orientation belongs to the XR runtime.
// =========================================================

export function rotateDesktopCamera(
  yawDelta,
  pitchDelta = 0
) {

  if (
    !camera ||
    renderer?.xr?.isPresenting
  ) {

    return;

  }


  camera.rotation.y -=
    yawDelta;


  camera.rotation.x -=
    pitchDelta;


  /*
    Prevent flipping upside down.
  */

  const limit =
    Math.PI / 2 - 0.05;


  camera.rotation.x =
    THREE.MathUtils.clamp(
      camera.rotation.x,
      -limit,
      limit
    );

}


// =========================================================
// ROTATE XR WORLD
//
// The headset controls camera rotation.
//
// Artificial turning therefore rotates WORLD_ROOT around
// the player instead of changing the XR camera rotation.
// =========================================================

export function rotateXRWorld(
  radians
) {

  if (
    !WORLD_ROOT ||
    !renderer?.xr?.isPresenting
  ) {

    return;

  }


  /*
    For V1 we're rotating the entire world root.

    Later we can improve this so rotation occurs exactly
    around the player's current tracked floor position.
  */

  WORLD_ROOT.rotation.y +=
    radians;

}


// =========================================================
// RESET WORLD TRANSFORM
// =========================================================

export function resetWorldTransform() {

  if (!WORLD_ROOT) {
    return;
  }


  WORLD_ROOT.position.set(
    0,
    0,
    0
  );


  WORLD_ROOT.rotation.set(
    0,
    0,
    0
  );


  WORLD_ROOT.scale.set(
    1,
    1,
    1
  );

}


// =========================================================
// RENDER ONCE
//
// Helpful before the animation loop starts.
// =========================================================

export function renderOnce() {

  if (
    !renderer ||
    !scene ||
    !camera
  ) {

    return;

  }


  renderer.render(
    scene,
    camera
  );

}