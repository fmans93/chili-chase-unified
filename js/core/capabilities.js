// js/core/capabilities.js
// CHILI CHASE UNIFIED
// Device/capability detection must NEVER block game startup.

export const CAPABILITIES = {
    touch: false,
    coarsePointer: false,
    mobileLike: false,

    orientation: false,
    orientationPermissionRequired: false,

    webXR: false,
    immersiveAR: false,

    handTracking: false,
    hitTest: false,
    domOverlay: false,

    mode: "unknown",
    userAgent: navigator.userAgent || "",

    initialized: false
};


// ---------------------------------------------------------
// SAFE TIMEOUT
// ---------------------------------------------------------

function withTimeout(promise, milliseconds, fallback = false) {

    return Promise.race([
        promise,

        new Promise((resolve) => {
            setTimeout(() => resolve(fallback), milliseconds);
        })
    ]);
}


// ---------------------------------------------------------
// DEVICE DETECTION
// ---------------------------------------------------------

export async function detectCapabilities() {

    console.log("[CHILI] Detecting device capabilities...");

    // -----------------------------------------------------
    // BASIC DETECTION
    // -----------------------------------------------------

    CAPABILITIES.touch =
        ("ontouchstart" in window) ||
        navigator.maxTouchPoints > 0;

    CAPABILITIES.coarsePointer =
        window.matchMedia?.("(pointer: coarse)")?.matches || false;

    const mobileUA =
        /Android|iPhone|iPad|iPod|Mobile/i.test(
            navigator.userAgent || ""
        );

    CAPABILITIES.mobileLike =
        CAPABILITIES.touch ||
        CAPABILITIES.coarsePointer ||
        mobileUA;


    // -----------------------------------------------------
    // ORIENTATION / GYRO
    // -----------------------------------------------------

    CAPABILITIES.orientation =
        "DeviceOrientationEvent" in window;

    CAPABILITIES.orientationPermissionRequired =
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function";


    // -----------------------------------------------------
    // WEBXR
    // -----------------------------------------------------

    CAPABILITIES.webXR =
        !!navigator.xr &&
        typeof navigator.xr.isSessionSupported === "function";


    // -----------------------------------------------------
    // SET INITIAL MODE IMMEDIATELY
    //
    // IMPORTANT:
    // We DO NOT wait for WebXR before allowing the game
    // to start.
    // -----------------------------------------------------

    if (CAPABILITIES.mobileLike) {

        setDeviceMode("phone");

    } else {

        setDeviceMode("desktop");
    }


    CAPABILITIES.initialized = true;

    updateDeviceStatus();

    console.log(
        "[CHILI] Basic device detection complete:",
        CAPABILITIES
    );


    // -----------------------------------------------------
    // WEBXR CHECK
    //
    // Some mobile browsers can take too long or fail here.
    // Timeout prevents the entire game from hanging.
    // -----------------------------------------------------

    if (CAPABILITIES.webXR) {

        try {

            CAPABILITIES.immersiveAR =
                await withTimeout(
                    navigator.xr.isSessionSupported("immersive-ar"),
                    1200,
                    false
                );

        } catch (error) {

            console.warn(
                "[CHILI] WebXR capability check failed:",
                error
            );

            CAPABILITIES.immersiveAR = false;
        }
    }


    // -----------------------------------------------------
    // OPTIONAL XR FEATURES
    //
    // Actual availability will be confirmed when an XR
    // session begins.
    // -----------------------------------------------------

    if (CAPABILITIES.immersiveAR) {

        CAPABILITIES.handTracking = true;
        CAPABILITIES.hitTest = true;
        CAPABILITIES.domOverlay = true;
    }


    updateDeviceStatus();

    updateDebugUI();

    console.log(
        "[CHILI] Full capability detection complete:",
        CAPABILITIES
    );

    return CAPABILITIES;
}


// ---------------------------------------------------------
// DEVICE MODE
// ---------------------------------------------------------

export function setDeviceMode(mode) {

    CAPABILITIES.mode = mode;

    document.body.classList.remove(
        "phone-mode",
        "glasses-mode",
        "xr-mode",
        "desktop-mode"
    );


    if (mode === "phone") {

        document.body.classList.add("phone-mode");

    } else if (mode === "glasses") {

        document.body.classList.add("glasses-mode");

    } else if (mode === "xr") {

        document.body.classList.add("xr-mode");

    } else {

        document.body.classList.add("desktop-mode");
    }


    updateDeviceStatus();
    updateDebugUI();
}


// ---------------------------------------------------------
// STATUS TEXT
// ---------------------------------------------------------

export function updateDeviceStatus() {

    const status =
        document.getElementById("device-status");

    if (!status) return;


    if (!CAPABILITIES.initialized) {

        status.textContent =
            "DETECTING DEVICE...";

        return;
    }


    if (CAPABILITIES.mode === "glasses") {

        status.textContent =
            "GLASSES READY";

        return;
    }


    if (CAPABILITIES.mode === "xr") {

        status.textContent =
            "AR SESSION ACTIVE";

        return;
    }


    if (CAPABILITIES.mobileLike) {

        if (CAPABILITIES.immersiveAR) {

            status.textContent =
                "PHONE READY • AR AVAILABLE";

        } else {

            status.textContent =
                "PHONE READY";
        }

        return;
    }


    if (CAPABILITIES.immersiveAR) {

        status.textContent =
            "XR DEVICE READY";

    } else {

        status.textContent =
            "DEBUG MODE";
    }
}


// ---------------------------------------------------------
// ORIENTATION PERMISSION
// ---------------------------------------------------------

export async function requestOrientationPermission() {

    if (!CAPABILITIES.orientation) {

        return false;
    }


    try {

        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const result =
                await DeviceOrientationEvent.requestPermission();

            return result === "granted";
        }


        return true;

    } catch (error) {

        console.warn(
            "[CHILI] Orientation permission failed:",
            error
        );

        return false;
    }
}


// ---------------------------------------------------------
// DEBUG UI
// ---------------------------------------------------------

export function updateDebugUI() {

    const mode =
        document.getElementById("debug-mode");

    const xr =
        document.getElementById("debug-xr");

    const head =
        document.getElementById("debug-head");

    const hand =
        document.getElementById("debug-hand");


    if (mode) {

        mode.textContent =
            `MODE: ${CAPABILITIES.mode.toUpperCase()}`;
    }


    if (xr) {

        xr.textContent =
            `XR: ${
                CAPABILITIES.immersiveAR
                    ? "AVAILABLE"
                    : "NO"
            }`;
    }


    if (head) {

        head.textContent =
            `HEAD: ${
                CAPABILITIES.orientation
                    ? "AVAILABLE"
                    : "NO"
            }`;
    }


    if (hand) {

        hand.textContent =
            `HAND: ${
                CAPABILITIES.handTracking
                    ? "POSSIBLE"
                    : "NO"
            }`;
    }
}


// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

export function isPhoneDevice() {

    return CAPABILITIES.mobileLike;
}


export function isXRAvailable() {

    return CAPABILITIES.immersiveAR;
}


export function getDeviceMode() {

    return CAPABILITIES.mode;
}