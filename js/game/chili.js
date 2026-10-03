// =========================================================
// CHILI CHASE // UNIFIED
// game/chili.js
//
// V1 Death Chili system.
//
// Handles:
// - GLB loading
// - model normalization
// - floor grounding
// - animation discovery
// - animation playback
// - initial placement
// - basic facing behavior
//
// More advanced AI comes AFTER our unified AR baseline
// is proven.
// =========================================================

import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
  CONFIG,
  logConfig,
  warnConfig
} from "../config.js";

import {
  WORLD_ROOT
} from "../core/scene.js";


// =========================================================
// LOADER
// =========================================================

const loader =
  new GLTFLoader();


// =========================================================
// CHILI STATE
// =========================================================

export const CHILI = {

  loaded: false,

  holder: null,

  model: null,

  mixer: null,

  clips: [],

  actions: {},

  currentAction: null,

  currentAnimationName: "",

  state: "LOADING",

  health: 100,

  maxHealth: 100

};


// =========================================================
// TEMPORARY OBJECTS
// =========================================================

const tempBox =
  new THREE.Box3();

const tempSize =
  new THREE.Vector3();

const tempCenter =
  new THREE.Vector3();

const tempTarget =
  new THREE.Vector3();


// =========================================================
// LOAD DEATH CHILI
// =========================================================

export async function loadDeathChili() {

  if (!WORLD_ROOT) {

    throw new Error(
      "WORLD_ROOT does not exist. createScene() must run before loadDeathChili()."
    );

  }


  logConfig(
    "Loading Death Chili:",
    CONFIG.ASSETS.DEATH_CHILI
  );


  CHILI.state =
    "LOADING";


  updateChiliStatus(
    "LOADING..."
  );


  try {

    const gltf =
      await loader.loadAsync(
        CONFIG.ASSETS.DEATH_CHILI
      );


    // -----------------------------------------------------
    // ORIGINAL MODEL
    // -----------------------------------------------------

    const model =
      gltf.scene;


    model.name =
      "DEATH_CHILI_MODEL";


    CHILI.model =
      model;


    // -----------------------------------------------------
    // MODEL MATERIAL / SHADOW SETUP
    // -----------------------------------------------------

    model.traverse(
      (object) => {

        if (!object.isMesh) {
          return;
        }


        object.castShadow =
          true;


        object.receiveShadow =
          true;


        /*
          Helps prevent accidental raycasting against
          hidden helper objects later.
        */

        object.userData.isChili =
          true;


        if (object.material) {

          /*
            Some GLBs share materials.

            We don't need to modify them yet, but keeping
            texture color space correct helps imported
            models display as intended.
          */

          const materials =
            Array.isArray(
              object.material
            )
              ? object.material
              : [object.material];


          for (
            const material
            of materials
          ) {

            if (
              material.map
            ) {

              material.map.colorSpace =
                THREE.SRGBColorSpace;

              material.map.needsUpdate =
                true;

            }

          }

        }

      }
    );


    // -----------------------------------------------------
    // NORMALIZE MODEL
    // -----------------------------------------------------

    normalizeModel(
      model,
      CONFIG.CHILI.TARGET_HEIGHT
    );


    // -----------------------------------------------------
    // HOLDER
    //
    // Holder controls world movement / rotation.
    // Model stays normalized inside it.
    // -----------------------------------------------------

    const holder =
      new THREE.Group();


    holder.name =
      "DEATH_CHILI_HOLDER";


    holder.userData.isChili =
      true;


    holder.add(
      model
    );


    CHILI.holder =
      holder;


    // -----------------------------------------------------
    // START POSITION
    // -----------------------------------------------------

    holder.position.set(

      CONFIG.CHILI.START_POSITION.x,

      CONFIG.CHILI.START_POSITION.y,

      CONFIG.CHILI.START_POSITION.z

    );


    WORLD_ROOT.add(
      holder
    );


    // -----------------------------------------------------
    // ANIMATIONS
    // -----------------------------------------------------

    setupAnimations(
      gltf.animations || []
    );


    // -----------------------------------------------------
    // STARTING ANIMATION
    // -----------------------------------------------------

    if (
      hasAnimation("idle")
    ) {

      playChiliAnimation(
        "idle"
      );

    }

    else if (
      hasAnimation("Walk")
    ) {

      playChiliAnimation(
        "Walk"
      );

    }

    else if (
      CHILI.clips.length > 0
    ) {

      playChiliAnimation(
        CHILI.clips[0].name
      );

    }


    CHILI.loaded =
      true;


    CHILI.state =
      "IDLE";


    updateChiliStatus(
      "READY"
    );


    logConfig(
      "Death Chili loaded successfully."
    );


    logConfig(
      "Death Chili animations:",
      CHILI.clips.map(
        clip => clip.name
      )
    );


    return CHILI;

  }

  catch (error) {

    CHILI.loaded =
      false;


    CHILI.state =
      "ERROR";


    updateChiliStatus(
      "LOAD ERROR"
    );


    warnConfig(
      "Death Chili failed to load:",
      error
    );


    throw error;

  }

}


// =========================================================
// NORMALIZE MODEL
//
// This follows the approach that behaved well in our
// earlier Chili builds:
//
// 1. Measure model.
// 2. Scale model to target height.
// 3. Measure again.
// 4. Center X/Z.
// 5. Put lowest Y point exactly on floor.
//
// This is much safer than trusting the scale/origin stored
// inside the GLB.
// =========================================================

function normalizeModel(
  model,
  targetHeight
) {

  // Reset transforms we control.

  model.position.set(
    0,
    0,
    0
  );


  // -------------------------------------------------------
  // FIRST MEASUREMENT
  // -------------------------------------------------------

  model.updateMatrixWorld(
    true
  );


  tempBox.setFromObject(
    model
  );


  tempBox.getSize(
    tempSize
  );


  const originalHeight =
    tempSize.y;


  if (
    !Number.isFinite(
      originalHeight
    )

    ||

    originalHeight <= 0
  ) {

    throw new Error(
      "Death Chili model has an invalid bounding-box height."
    );

  }


  // -------------------------------------------------------
  // UNIFORM SCALE
  // -------------------------------------------------------

  const scale =
    targetHeight /
    originalHeight;


  model.scale.multiplyScalar(
    scale
  );


  // -------------------------------------------------------
  // RE-MEASURE AFTER SCALE
  // -------------------------------------------------------

  model.updateMatrixWorld(
    true
  );


  tempBox.setFromObject(
    model
  );


  tempBox.getSize(
    tempSize
  );


  tempBox.getCenter(
    tempCenter
  );


  // -------------------------------------------------------
  // CENTER X / Z
  // -------------------------------------------------------

  model.position.x -=
    tempCenter.x;


  model.position.z -=
    tempCenter.z;


  /*
    Recalculate after changing X/Z position so our Y
    grounding measurement is based on the final horizontal
    placement.
  */

  model.updateMatrixWorld(
    true
  );


  tempBox.setFromObject(
    model
  );


  // -------------------------------------------------------
  // GROUND Y
  //
  // If the bottom of the model is at -0.62,
  // moving it upward +0.62 places the feet at Y=0.
  // -------------------------------------------------------

  model.position.y -=
    tempBox.min.y;


  // -------------------------------------------------------
  // FINAL MEASUREMENT
  // -------------------------------------------------------

  model.updateMatrixWorld(
    true
  );


  tempBox.setFromObject(
    model
  );


  tempBox.getSize(
    tempSize
  );


  logConfig(
    "Death Chili normalized:",
    {
      targetHeight,
      finalHeight:
        Number(
          tempSize.y.toFixed(3)
        ),
      scale:
        Number(
          scale.toFixed(5)
        ),
      floorY:
        Number(
          tempBox.min.y.toFixed(4)
        )
    }
  );

}


// =========================================================
// SETUP ANIMATIONS
// =========================================================

function setupAnimations(
  clips
) {

  CHILI.clips =
    clips;


  CHILI.actions = {};


  if (
    !CHILI.model
  ) {

    return;

  }


  if (
    clips.length === 0
  ) {

    warnConfig(
      "Death Chili contains no animation clips."
    );

    return;

  }


  CHILI.mixer =
    new THREE.AnimationMixer(
      CHILI.model
    );


  for (
    const clip
    of clips
  ) {

    const action =
      CHILI.mixer.clipAction(
        clip
      );


    CHILI.actions[
      clip.name
    ] = action;


    /*
      Also create a lowercase lookup.

      That lets us request "run" even if the actual GLB
      calls it "Run".
    */

    const lowerName =
      clip.name.toLowerCase();


    if (
      !CHILI.actions[
        lowerName
      ]
    ) {

      CHILI.actions[
        lowerName
      ] = action;

    }

  }

}


// =========================================================
// FIND ANIMATION
// =========================================================

function getAnimationAction(
  name
) {

  if (!name) {
    return null;
  }


  if (
    CHILI.actions[name]
  ) {

    return CHILI.actions[name];

  }


  const lower =
    name.toLowerCase();


  if (
    CHILI.actions[lower]
  ) {

    return CHILI.actions[lower];

  }


  /*
    Last fallback:
    search the original clip names case-insensitively.
  */

  const clip =
    CHILI.clips.find(
      item =>
        item.name.toLowerCase()
        === lower
    );


  if (!clip) {
    return null;
  }


  return CHILI.mixer?.clipAction(
    clip
  ) || null;

}


// =========================================================
// CHECK ANIMATION
// =========================================================

export function hasAnimation(
  name
) {

  return Boolean(
    getAnimationAction(
      name
    )
  );

}


// =========================================================
// PLAY ANIMATION
// =========================================================

export function playChiliAnimation(
  name,
  fadeTime = 0.18
) {

  if (
    !CHILI.mixer
  ) {

    return false;

  }


  const nextAction =
    getAnimationAction(
      name
    );


  if (!nextAction) {

    warnConfig(
      `Chili animation not found: ${name}`
    );

    return false;

  }


  /*
    Don't restart the same animation every frame.
  */

  if (
    CHILI.currentAction ===
    nextAction
  ) {

    return true;

  }


  const previousAction =
    CHILI.currentAction;


  nextAction.enabled =
    true;


  nextAction.reset();


  nextAction.setEffectiveTimeScale(
    1
  );


  nextAction.setEffectiveWeight(
    1
  );


  nextAction.play();


  if (
    previousAction
  ) {

    previousAction.crossFadeTo(
      nextAction,
      fadeTime,
      false
    );

  }


  CHILI.currentAction =
    nextAction;


  CHILI.currentAnimationName =
    name;


  return true;

}


// =========================================================
// FACE A WORLD POSITION
//
// Keeps Chili upright.
//
// We only rotate around Y.
// =========================================================

export function faceChiliToward(
  worldPosition
) {

  if (
    !CHILI.holder ||
    !worldPosition
  ) {

    return;

  }


  /*
    holder may live under WORLD_ROOT, so convert the
    requested world position into holder-parent space.
  */

  tempTarget.copy(
    worldPosition
  );


  if (
    CHILI.holder.parent
  ) {

    CHILI.holder.parent.worldToLocal(
      tempTarget
    );

  }


  const dx =
    tempTarget.x -
    CHILI.holder.position.x;


  const dz =
    tempTarget.z -
    CHILI.holder.position.z;


  if (
    Math.abs(dx) +
    Math.abs(dz) <
    0.0001
  ) {

    return;

  }


  /*
    Most Three.js characters face +Z or -Z depending on
    export orientation.

    We start with this orientation and visually verify it
    before changing anything.
  */

  CHILI.holder.rotation.y =
    Math.atan2(
      dx,
      dz
    );

}


// =========================================================
// SET CHILI POSITION
// =========================================================

export function setChiliPosition(
  x,
  y,
  z
) {

  if (
    !CHILI.holder
  ) {

    return;

  }


  CHILI.holder.position.set(
    x,
    y,
    z
  );

}


// =========================================================
// GET CHILI WORLD POSITION
// =========================================================

export function getChiliWorldPosition(
  target = new THREE.Vector3()
) {

  if (
    !CHILI.holder
  ) {

    return target.set(
      0,
      0,
      0
    );

  }


  CHILI.holder.getWorldPosition(
    target
  );


  return target;

}


// =========================================================
// GET RAYCAST TARGETS
//
// Later the lasso system can use this.
// =========================================================

export function getChiliRaycastTargets() {

  if (
    !CHILI.model
  ) {

    return [];

  }


  const targets = [];


  CHILI.model.traverse(
    object => {

      if (
        object.isMesh &&
        object.visible
      ) {

        targets.push(
          object
        );

      }

    }
  );


  return targets;

}


// =========================================================
// UPDATE
//
// Called every frame by main.js.
// =========================================================

export function updateChili(
  deltaTime
) {

  if (
    !CHILI.loaded
  ) {

    return;

  }


  // -------------------------------------------------------
  // ANIMATION
  // -------------------------------------------------------

  if (
    CHILI.mixer
  ) {

    CHILI.mixer.update(
      deltaTime
    );

  }


  /*
    V1 intentionally stops here.

    We are NOT adding chase/attack/cover AI yet.

    First we prove:
      - model loads
      - correct scale
      - correct floor position
      - animations work
      - AR placement works
      - phone/glasses inputs work

    Then Chili AI gets added on top of a stable base.
  */

}


// =========================================================
// STATUS UI
// =========================================================

function updateChiliStatus(
  text
) {

  const element =
    document.getElementById(
      "chili-status"
    );


  if (
    element
  ) {

    element.textContent =
      text;

  }

}