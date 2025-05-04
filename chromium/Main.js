const CLASSES_TO_REMOVE = [
    "layout-item_styles__zc08zp30 default-ltr-cache-7vbe6a ermvlvv0",
    "default-ltr-cache-1sfbp89 e1qcljkj0",
    "css-1nym653 modal-enter-done",
    "nf-modal interstitial-full-screen",
];

// State object that contains all controller elements and state
let state = {
    progressionIntervalId: null,
    controllerElement: null,
    buttonPlayPause: null,
    buttonFullScreen: null,
    progressionBar: null,
    screenTime: null,
    videoElement: null,
    volumeSlider: null,
    lastScreenTime: -1,
    lastTotalTime: -1,
    isControllerAdded: false,
    mutationTimeout: null,
    controllerTimerId: null,
    isControllerVisible: true,
    controllerHideTimer: null,
    videoOverlay: null,
    keyboardListener: null,
    messageOverlay: null,
    messageTimer: null,
    seekAmount: 10, // seconds to seek with arrow keys
    backButton: null, // New property to track the back button element

    // Subtitle-related state
    subtitleEnabled: true,
    bilingualEnabled: false,
    primarySubtitleTrack: null,
    secondarySubtitleTrack: null,
    availableSubtitleTracks: [],
    subtitleObserver: null,
    subtitleContainer: null,
    subtitleSettingsOpen: false,
    subtitleSettingsPanel: null,
    primaryLanguage: "en", // Default primary language
    secondaryLanguage: "es", // Default secondary language
    subtitlePosition: "bottom", // Can be "bottom" or "top"
    subtitleSize: "medium", // Can be "small", "medium", "large"
    primaryColor: "white",
    secondaryColor: "#FFD700", // Gold color for secondary language
    subtitleBackgroundOpacity: 0.5,

    // Translation state
    lastTranslationRequest: 0,
    translationDelay: 300, // ms between translation requests to avoid rate limiting
};

// Constants
const CONTROLLER_ID = "mon-controleur-netflix";
const NETFLIX_WATCH_REGEX = /^https:\/\/www\.netflix\.com\/watch\/\d+/;
const CONTROLLER_INIT_DELAY = 1500; // Reduced from 3000ms
const CONTROLLER_HIDE_DELAY = 3000; // Hide controller after 3 seconds of inactivity
const SUBTITLE_SETTINGS_ID = "netflix-subtitle-settings";
const SUBTITLE_OBSERVER_CONFIG = { childList: true, subtree: true };

// Language name mapping for display
const LANGUAGE_NAMES = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ar: "Arabic",
    hi: "Hindi",
    tr: "Turkish",
    // Add more languages as needed
};

// script injecter to seek using progress bar
function injectScript(fileName) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(fileName);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

// Inject the script
injectScript("netflix-seeker.js");

/**
 * Check if the current URL is a Netflix watch URL
 * @returns {boolean} True if on Netflix watch page
 */
function isOnNetflixWatch() {
    return NETFLIX_WATCH_REGEX.test(window.location.href);
}

/**
 * Format time in seconds to MM:SS format
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
function timeFormat(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

/**
 * Update the progress bar and time display
 */
function updateProgression() {
    const { videoElement, progressionBar, screenTime } = state;

    if (!videoElement || !progressionBar || !screenTime) return;

    if (videoElement.duration) {
        const percentage = (videoElement.currentTime / videoElement.duration) * 100;
        progressionBar.style.width = `${percentage}%`;

        const currentTime = Math.floor(videoElement.currentTime);
        const totalTime = Math.floor(videoElement.duration);

        if (
            state.lastScreenTime !== currentTime ||
            state.lastTotalTime !== totalTime
        ) {
            state.lastScreenTime = currentTime;
            state.lastTotalTime = totalTime;
            screenTime.textContent = `${timeFormat(currentTime)} / ${timeFormat(
                totalTime
            )}`;
        }
    }
}

/**
 * Toggle fullscreen mode
 */
function toggleFullScreen() {
    const container = document.querySelector(".netflix-player");
    const fullscreenElement = container || state.videoElement;

    if (!fullscreenElement) return;

    if (!document.fullscreenElement) {
        if (fullscreenElement.requestFullscreen) {
            fullscreenElement.requestFullscreen();
        } else if (fullscreenElement.mozRequestFullScreen) {
            fullscreenElement.mozRequestFullScreen();
        } else if (fullscreenElement.webkitRequestFullscreen) {
            fullscreenElement.webkitRequestFullscreen();
        } else if (fullscreenElement.msRequestFullscreen) {
            fullscreenElement.msRequestFullscreen();
        }
        if (state.buttonFullScreen) {
            state.buttonFullScreen.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 3.41L16.41 9L18 10.59L23.59 5L22 3.41M2 5L7.59 10.59L9.18 9L3.59 3.41L2 5M18 13.41L16.41 15L22 20.59L23.59 19L18 13.41M9.18 15L7.59 13.41L2 19L3.59 20.59L9.18 15Z" fill="white"/></svg>';
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        if (state.buttonFullScreen) {
            state.buttonFullScreen.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.59 5.59L18 7L12 13L7.41 18.41L6 17L12 11L18 17L16.59 18.41Z" fill="white"/></svg>';
        }
    }
}

/**
 * Create and add styles if not already present
 */
function createStylesIfNeeded() {
    if (!document.getElementById("netflix-controller-styles")) {
        const style = document.createElement("style");
        style.id = "netflix-controller-styles";
        style.textContent = `
   #mon-controleur-netflix {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(to top, 
        rgba(0, 0, 0, 1) 0%, 
        rgba(0, 0, 0, 0.9) 10%, 
        rgba(0, 0, 0, 0.8) 20%, 
        rgba(0, 0, 0, 0.7) 30%, 
        rgba(0, 0, 0, 0.6) 40%, 
        rgba(0, 0, 0, 0.4) 50%, 
        rgba(0, 0, 0, 0.2) 65%, 
        rgba(0, 0, 0, 0.1) 80%, 
        rgba(0, 0, 0, 0) 100%);
    color: white;
    padding: 18px 20px;
    padding-top: 60px; /* Extended padding for better gradient effect */
    z-index: 9999;
    display: flex;
    align-items: center; /* Changed from flex-end to center for better alignment */
    justify-content: space-between;
    font-family: 'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    transform: translateZ(0); 
    will-change: transform; 
    pointer-events: auto;
    transition: opacity 0.3s ease;
    opacity: 1;
}

#netflix-video-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9998;
    background-color: transparent;
    pointer-events: none; /* Allow clicks to pass through to Netflix controls */
}

#netflix-video-area-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%; 
    height: calc(100% - 140px); /* Exclude Netflix controls area */
    z-index: 9997;
    cursor: pointer;
    background-color: transparent;
}

#netflix-message-overlay {
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 15px 25px;
    border-radius: 5px;
    font-size: 20px;
    font-weight: 500;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
}

#mon-controleur-netflix.hidden {
    opacity: 0;
    pointer-events: none;
}

.netflix-control-button {
    background: transparent;
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.netflix-control-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
}

.netflix-control-button:active {
    transform: scale(0.95);
}

#netflix-play-pause, 
#netflix-plein-ecran,
#netflix-next-episode,
#netflix-subtitle-toggle,
#netflix-bilingual-toggle {
    background-color: transparent;
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

#netflix-play-pause:hover, 
#netflix-plein-ecran:hover,
#netflix-subtitle-toggle:hover,
#netflix-bilingual-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
}

#netflix-play-pause:active, 
#netflix-plein-ecran:active,
#netflix-subtitle-toggle:active,
#netflix-bilingual-toggle:active {
    transform: scale(0.95);
}

#netflix-barre-container {
    flex: 1;
    height: 4px;
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
    margin: 0 20px;
    position: relative;
    transition: height 0.2s ease;
    align-self: center; /* Center vertically within flex container */
}

#netflix-barre-container:hover {
    height: 6px;
}

#netflix-barre-container:hover #netflix-barre-progression {
    background-color: #E50914;
}

#netflix-barre-progression {
    height: 100%;
    background-color: #E50914;
    width: 0%;
    will-change: width; 
    transform: translateZ(0);
    position: relative;
}

#netflix-barre-progression::after {
    content: '';
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%) scale(0);
    width: 12px;
    height: 12px;
    background-color: #E50914;
    border-radius: 50%;
    transition: transform 0.2s ease;
}

#netflix-barre-container:hover #netflix-barre-progression::after {
    transform: translateY(-50%) scale(1);
}

#netflix-temps {
    margin: 0 15px;
    width: auto; 
    font-weight: 500;
    font-size: 14px;
    opacity: 0.9;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

#netflix-volume-container {
    display: flex;
    align-items: center;
    margin-left: 10px;
    position: relative;
}

#netflix-volume-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

#netflix-volume-icon:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

#netflix-volume-slider-container {
    width: 0;
    overflow: hidden;
    transition: width 0.3s ease;
    height: 40px;
    display: flex;
    align-items: center;
}

#netflix-volume-container:hover #netflix-volume-slider-container {
    width: 100px;
}

#netflix-volume-slider {
    width: 80px;
    height: 4px;
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    outline: none;
    margin-left: 10px;
    -webkit-appearance: none;
    appearance: none;
}

#netflix-volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background-color: white;
    border-radius: 50%;
    cursor: pointer;
}

#netflix-volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background-color: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
}

#netflix-volume-slider:hover {
    height: 5px;
}

.controls-left, .controls-right {
    display: flex;
    align-items: center;
    height: 40px; /* Fixed height to ensure consistent alignment */
}

.controls-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
}

/* Subtitle settings panel styles */
#netflix-subtitle-settings {
    position: absolute;
    bottom: 80px;
    right: 20px;
    width: 350px;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: 5px;
    padding: 15px;
    z-index: 10001;
    display: none;
    color: white;
    font-family: 'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.7);
}

#netflix-subtitle-settings.visible {
    display: block;
}

#netflix-subtitle-settings h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 16px;
    font-weight: 500;
    color: #E50914;
}

.subtitle-settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.subtitle-settings-row:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

.subtitle-settings-label {
    font-weight: 500;
    font-size: 14px;
}

.subtitle-settings-control {
    display: flex;
    align-items: center;
}

.subtitle-select {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 13px;
    outline: none;
}

.subtitle-select option {
    background-color: #333;
}

.subtitle-toggle-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
}

.subtitle-toggle-switch input { 
    opacity: 0;
    width: 0;
    height: 0;
}

.subtitle-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: .3s;
    border-radius: 20px;
}

.subtitle-toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
}

input:checked + .subtitle-toggle-slider {
    background-color: #E50914;
}

input:focus + .subtitle-toggle-slider {
    box-shadow: 0 0 1px #E50914;
}

input:checked + .subtitle-toggle-slider:before {
    transform: translateX(20px);
}

/* Custom dual subtitles styling */
.player-timedtext[dual-subtitles='true'] {
    position: fixed !important; /* Use fixed instead of absolute to ensure consistent positioning */
    bottom: 80px !important;  /* Position above the controller */
    top: auto !important; /* Override any top positioning from Netflix */
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    display: flex !important;
    justify-content: center !important;
    align-items: flex-end !important; /* Align to bottom */
    pointer-events: none !important;
    z-index: 9996 !important; /* Make sure it's above video but below controls */
    transform: none !important; /* Reset any transforms */
}

.player-timedtext[dual-subtitles='true'] .player-timedtext-text-container {
    max-width: 80% !important; /* Limit width to prevent overflow */
    margin: 0 auto !important;
    background-color: rgba(0, 0, 0, var(--subtitle-bg-opacity, 0.5));
    padding: 8px 16px;
    border-radius: 4px;
    text-align: center !important;
    position: relative !important; /* Reset any absolute positioning */
    left: 0 !important; /* Reset any left positioning */
    right: 0 !important; /* Reset any right positioning */
    transform: none !important; /* Reset any transforms */
    width: auto !important; /* Let the width be determined by content with max-width limit */
}

/* Fix subtitle text to prevent overflow and ensure proper wrapping */
.player-timedtext[dual-subtitles='true'] .player-timedtext-text-container span {
    white-space: normal !important; /* Allow text to wrap */
    overflow-wrap: break-word !important; /* Break long words if needed */
    word-break: break-word !important; /* Break words at appropriate points */
    display: inline-block !important; /* Keep the text behavior consistent */
    max-width: 100% !important; /* Prevent overflow */
}

.primary-subtitle {
    color: var(--primary-color, white);
    font-size: var(--subtitle-size, 1.4em);
    margin-bottom: 8px;
    font-weight: 500;
    line-height: 1.4;
    text-align: center !important;
    width: 100% !important;
    max-width: 100% !important;
    white-space: normal !important;
    overflow-wrap: break-word !important;
}

.secondary-subtitle {
    color: var(--secondary-color, #FFD700);
    font-size: var(--subtitle-size, 1.3em);
    font-style: italic;
    line-height: 1.4;
    text-align: center !important;
    width: 100% !important;
    max-width: 100% !important;
    white-space: normal !important;
    overflow-wrap: break-word !important;
}

/* Subtitle color options */
.color-option {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 5px;
    cursor: pointer;
    border: 2px solid transparent;
}

.color-option.selected {
    border-color: white;
}

.color-white { background-color: white; }
.color-yellow { background-color: #FFD700; }
.color-cyan { background-color: #00FFFF; }
.color-green { background-color: #7FFF00; }
.color-pink { background-color: #FF69B4; }

/* Size options */
.size-option {
    padding: 3px 8px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    margin-right: 5px;
    cursor: pointer;
    font-size: 12px;
}

.size-option.selected {
    background-color: rgba(255, 255, 255, 0.3);
}

/* For proper subtitle sizing */
:root {
    --small-subtitle-size: 2.4em;
    --medium-subtitle-size: 2.7em;
    --large-subtitle-size: 3em;
}
    `;
        document.body.appendChild(style);
    }
}

/**
 * Clean up controller elements and reset state
 */
function cleanController() {
    if (state.progressionIntervalId) {
        cancelAnimationFrame(state.progressionIntervalId);
        state.progressionIntervalId = null;
    }

    if (state.controllerHideTimer) {
        clearTimeout(state.controllerHideTimer);
        state.controllerHideTimer = null;
    }

    if (state.subtitleObserver) {
        state.subtitleObserver.disconnect();
        state.subtitleObserver = null;
    }

    if (state.controllerElement) {
        state.controllerElement.remove();
    }

    if (state.videoOverlay) {
        state.videoOverlay.remove();
    }

    // Also clean up the video area overlay
    const videoAreaOverlay = document.getElementById(
        "netflix-video-area-overlay"
    );
    if (videoAreaOverlay) {
        videoAreaOverlay.remove();
    }

    if (state.messageOverlay) {
        state.messageOverlay.remove();
    }

    if (state.subtitleSettingsPanel) {
        state.subtitleSettingsPanel.remove();
    }

    // Remove the back button
    if (state.backButton) {
        state.backButton.remove();
    }

    // Remove keyboard event listener if exists
    if (state.keyboardListener) {
        document.removeEventListener("keydown", state.keyboardListener);
        state.keyboardListener = null;
    }

    state = {
        ...state,
        controllerElement: null,
        buttonPlayPause: null,
        buttonFullScreen: null,
        progressionBar: null,
        screenTime: null,
        videoElement: null,
        volumeSlider: null,
        videoOverlay: null,
        keyboardListener: null,
        messageOverlay: null,
        messageTimer: null,
        isControllerAdded: false,
        isControllerVisible: true,
        seekAmount: 10,

        // Keep subtitle preferences, reset other subtitle state
        subtitleEnabled: state.subtitleEnabled,
        bilingualEnabled: state.bilingualEnabled,
        primaryLanguage: state.primaryLanguage,
        secondaryLanguage: state.secondaryLanguage,
        subtitlePosition: state.subtitlePosition,
        subtitleSize: state.subtitleSize,
        primaryColor: state.primaryColor,
        secondaryColor: state.secondaryColor,
        subtitleBackgroundOpacity: state.subtitleBackgroundOpacity,

        primarySubtitleTrack: null,
        secondarySubtitleTrack: null,
        availableSubtitleTracks: [],
        subtitleObserver: null,
        subtitleContainer: null,
        subtitleSettingsOpen: false,
        subtitleSettingsPanel: null,
    };
}

/**
 * Show the controller and set a timer to hide it
 */
function showController() {
    if (!state.controllerElement) return;

    state.controllerElement.classList.remove("hidden");
    state.isControllerVisible = true;
    
    // Show cursor when controls are visible
    const videoAreaOverlay = document.getElementById("netflix-video-area-overlay");
    if (videoAreaOverlay) {
        videoAreaOverlay.style.cursor = "pointer";
    }

    if (state.controllerHideTimer) {
        clearTimeout(state.controllerHideTimer);
    }

    state.controllerHideTimer = setTimeout(() => {
        if (
            state.controllerElement &&
            !state.videoElement.paused &&
            !state.subtitleSettingsOpen
        ) {
            state.controllerElement.classList.add("hidden");
            state.isControllerVisible = false;
            
            // Hide cursor when controls are hidden
            if (videoAreaOverlay) {
                videoAreaOverlay.style.cursor = "none";
            }
        }
    }, CONTROLLER_HIDE_DELAY);
}

/**
 * Show a message overlay with the given text
 * @param {string} message - Message to display
 * @param {number} duration - Duration to show message in milliseconds
 */
function showMessage(message, duration = 1500) {
    if (state.messageTimer) {
        clearTimeout(state.messageTimer);
        state.messageTimer = null;
    }

    if (!state.messageOverlay) {
        state.messageOverlay = document.createElement("div");
        state.messageOverlay.id = "netflix-message-overlay";
        document.body.appendChild(state.messageOverlay);
    }

    state.messageOverlay.textContent = message;
    state.messageOverlay.style.opacity = "1";

    state.messageTimer = setTimeout(() => {
        state.messageOverlay.style.opacity = "0";
    }, duration);
}

// Add Google Translate function
const googleTranslateCache = {};

/**
 * Translate text using Google Translate API
 * @param {string} text - Text to translate
 * @param {string} from - Source language code
 * @param {string} to - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, from, to) {
    if (!text || text.trim() === "") return "";

    // Check cache first
    const cacheKey = `${text}_${from}_${to}`;
    if (googleTranslateCache[cacheKey]) {
        return googleTranslateCache[cacheKey];
    }

    try {
        // Create a URL that works in browser context using Google Translate website directly
        const encodedText = encodeURIComponent(text);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodedText}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Translation failed with status: ${response.status}`);
        }

        const data = await response.json();

        // Extract the translation
        let translatedText = "";
        if (data && data[0]) {
            data[0].forEach((item) => {
                if (item[0]) {
                    translatedText += item[0];
                }
            });
        }

        // Save to cache
        googleTranslateCache[cacheKey] = translatedText;

        return translatedText;
    } catch (error) {
        console.error("Translation error:", error);
        // Fallback to simulation in case of error
        return `[Translation unavailable]`;
    }
}

/**
 * Detect subtitle tracks available on the video
 * @returns {Array} Array of subtitle tracks
 */
function detectSubtitleTracks() {
    // Check if we're on Netflix
    if (!isOnNetflixWatch()) return [];

    try {
        // Find Netflix's subtitle menu
        const subtitleMenu = document.querySelector(
            '[data-uia="video-subtitle-picker-label"]'
        );
        if (!subtitleMenu) return [];

        // Click to open subtitle menu
        subtitleMenu.click();

        // Get all subtitle options
        const subtitleOptions = Array.from(
            document.querySelectorAll('[data-uia="track-list-item"]')
        );

        // Extract subtitle data
        const tracks = subtitleOptions.map((option) => {
            // Get language code from data attribute or class
            const langCode =
                option.getAttribute("data-lang") ||
                option.getAttribute("data-language") ||
                extractLanguageCode(option.textContent);

            return {
                name: option.textContent.trim(),
                language: langCode || "unknown",
                element: option,
            };
        });

        // Close the menu by clicking outside
        document.body.click();

        return tracks;
    } catch (error) {
        console.error("Error detecting subtitle tracks:", error);
        return [];
    }
}

/**
 * Extract language code from subtitle name
 * @param {string} name - The name of the subtitle track
 * @returns {string|null} Language code or null if not found
 */
function extractLanguageCode(name) {
    if (!name) return null;

    // Try to match common language patterns in Netflix subtitle names
    const nameLower = name.toLowerCase();

    // Common language mappings
    for (const [code, langName] of Object.entries(LANGUAGE_NAMES)) {
        if (nameLower.includes(langName.toLowerCase())) {
            return code;
        }
    }

    // Additional common language names that might appear
    const langMap = {
        english: "en",
        spanish: "es",
        español: "es",
        french: "fr",
        français: "fr",
        german: "de",
        deutsch: "de",
        italian: "it",
        italiano: "it",
        portuguese: "pt",
        português: "pt",
        russian: "ru",
        русский: "ru",
        chinese: "zh",
        中文: "zh",
        japanese: "ja",
        日本語: "ja",
        korean: "ko",
        한국어: "ko",
        arabic: "ar",
        العربية: "ar",
        hindi: "hi",
        हिन्दी: "hi",
        turkish: "tr",
        türkçe: "tr",
    };
    for (const [langName, code] of Object.entries(langMap)) {
        if (nameLower.includes(langName)) {
            return code;
        }
    }

    return null;
}

/**
 * Create subtitle settings panel
 * @returns {HTMLElement} The settings panel element
 */
function createSubtitleSettings() {
    // Create settings panel
    const panel = document.createElement("div");
    panel.id = SUBTITLE_SETTINGS_ID;
    panel.className = state.subtitleSettingsOpen ? "visible" : "";

    // Create settings content
    panel.innerHTML = `
        <h3>Subtitle Settings</h3>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Subtitles</span>
            <div class="subtitle-settings-control">
                <label class="subtitle-toggle-switch">
                    <input type="checkbox" id="subtitle-toggle-checkbox" ${state.subtitleEnabled ? "checked" : ""
        }>
                    <span class="subtitle-toggle-slider"></span>
                </label>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Dual Subtitles</span>
            <div class="subtitle-settings-control">
                <label class="subtitle-toggle-switch">
                    <input type="checkbox" id="bilingual-toggle-checkbox" ${state.bilingualEnabled ? "checked" : ""
        }>
                    <span class="subtitle-toggle-slider"></span>
                </label>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Primary Language</span>
            <div class="subtitle-settings-control">
                <select id="primary-language-select" class="subtitle-select">
                    ${generateLanguageOptions(state.primaryLanguage)}
                </select>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Secondary Language</span>
            <div class="subtitle-settings-control">
                <select id="secondary-language-select" class="subtitle-select">
                    ${generateLanguageOptions(state.secondaryLanguage)}
                </select>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Primary Color</span>
            <div class="subtitle-settings-control">
                <div class="color-option color-white ${state.primaryColor === "white" ? "selected" : ""
        }" data-color="white"></div>
                <div class="color-option color-yellow ${state.primaryColor === "#FFD700" ? "selected" : ""
        }" data-color="#FFD700"></div>
                <div class="color-option color-cyan ${state.primaryColor === "#00FFFF" ? "selected" : ""
        }" data-color="#00FFFF"></div>
                <div class="color-option color-green ${state.primaryColor === "#7FFF00" ? "selected" : ""
        }" data-color="#7FFF00"></div>
                <div class="color-option color-pink ${state.primaryColor === "#FF69B4" ? "selected" : ""
        }" data-color="#FF69B4"></div>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Secondary Color</span>
            <div class="subtitle-settings-control">
                <div class="color-option color-white ${state.secondaryColor === "white" ? "selected" : ""
        }" data-color="white"></div>
                <div class="color-option color-yellow ${state.secondaryColor === "#FFD700" ? "selected" : ""
        }" data-color="#FFD700"></div>
                <div class="color-option color-cyan ${state.secondaryColor === "#00FFFF" ? "selected" : ""
        }" data-color="#00FFFF"></div>
                <div class="color-option color-green ${state.secondaryColor === "#7FFF00" ? "selected" : ""
        }" data-color="#7FFF00"></div>
                <div class="color-option color-pink ${state.secondaryColor === "#FF69B4" ? "selected" : ""
        }" data-color="#FF69B4"></div>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Text Size</span>
            <div class="subtitle-settings-control">
                <span class="size-option ${state.subtitleSize === "small" ? "selected" : ""
        }" data-size="small">Small</span>
                <span class="size-option ${state.subtitleSize === "medium" ? "selected" : ""
        }" data-size="medium">Medium</span>
                <span class="size-option ${state.subtitleSize === "large" ? "selected" : ""
        }" data-size="large">Large</span>
            </div>
        </div>
        
        <div class="subtitle-settings-row">
            <span class="subtitle-settings-label">Background</span>
            <div class="subtitle-settings-control">
                <input type="range" min="0" max="1" step="0.1" value="${state.subtitleBackgroundOpacity
        }" id="subtitle-bg-opacity">
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Add event listeners for settings controls
    panel
        .querySelector("#subtitle-toggle-checkbox")
        .addEventListener("change", (e) => {
            state.subtitleEnabled = e.target.checked;
            toggleSubtitles(state.subtitleEnabled);
        });

    panel
        .querySelector("#bilingual-toggle-checkbox")
        .addEventListener("change", (e) => {
            state.bilingualEnabled = e.target.checked;
            if (state.bilingualEnabled) {
                enableBilingualSubtitles();
            } else {
                disableBilingualSubtitles();
            }
        });

    panel
        .querySelector("#primary-language-select")
        .addEventListener("change", (e) => {
            state.primaryLanguage = e.target.value;
            if (state.bilingualEnabled) {
                // Force refresh of subtitle settings
                disableBilingualSubtitles();
                enableBilingualSubtitles();
            }
        });

    panel
        .querySelector("#secondary-language-select")
        .addEventListener("change", (e) => {
            state.secondaryLanguage = e.target.value;
            if (state.bilingualEnabled) {
                // Force refresh of subtitle settings
                disableBilingualSubtitles();
                enableBilingualSubtitles();
            }
        });

    // Color selection for subtitles
    panel.querySelectorAll(".color-option").forEach((option) => {
        option.addEventListener("click", (e) => {
            const color = e.target.getAttribute("data-color");
            const isForPrimary = e.target
                .closest(".subtitle-settings-row")
                .querySelector(".subtitle-settings-label")
                .textContent.includes("Primary");

            // Update selected UI
            e.target
                .closest(".subtitle-settings-control")
                .querySelectorAll(".color-option")
                .forEach((el) => {
                    el.classList.remove("selected");
                });
            e.target.classList.add("selected");

            // Update color state
            if (isForPrimary) {
                state.primaryColor = color;
            } else {
                state.secondaryColor = color;
            }

            // Apply color changes
            updateSubtitleStyles();
        });
    });

    // Size options
    panel.querySelectorAll(".size-option").forEach((option) => {
        option.addEventListener("click", (e) => {
            state.subtitleSize = e.target.getAttribute("data-size");

            // Update selected UI
            panel.querySelectorAll(".size-option").forEach((el) => {
                el.classList.remove("selected");
            });
            e.target.classList.add("selected");

            // Apply size changes
            updateSubtitleStyles();
        });
    });

    // Background opacity
    panel.querySelector("#subtitle-bg-opacity").addEventListener("input", (e) => {
        state.subtitleBackgroundOpacity = parseFloat(e.target.value);
        updateSubtitleStyles();
    });

    return panel;
}

/**
 * Generate HTML options for language dropdown
 * @param {string} selectedLang - Currently selected language code
 * @returns {string} HTML string of options
 */
function generateLanguageOptions(selectedLang) {
    let optionsHTML = "";

    for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
        const selected = code === selectedLang ? "selected" : "";
        optionsHTML += `<option value="${code}" ${selected}>${name}</option>`;
    }

    return optionsHTML;
}

/**
 * Toggle subtitles on/off
 * @param {boolean} enabled - Whether subtitles should be enabled
 */
function toggleSubtitles(enabled) {
    if (!state.videoElement) return;

    // Find Netflix's subtitle menu
    const subtitleMenu = document.querySelector(
        '[data-uia="video-subtitle-picker-label"]'
    );
    if (!subtitleMenu) return;

    try {
        // Click to open subtitle menu
        subtitleMenu.click();

        // Select appropriate option
        setTimeout(() => {
            let targetOption;

            if (enabled) {
                // Find option for primary language
                const options = Array.from(
                    document.querySelectorAll('[data-uia="track-list-item"]')
                );

                for (const option of options) {
                    const langCode =
                        option.getAttribute("data-lang") ||
                        option.getAttribute("data-language") ||
                        extractLanguageCode(option.textContent);

                    if (langCode === state.primaryLanguage) {
                        targetOption = option;
                        break;
                    }
                }

                // If no match found, select first non-off option
                if (!targetOption) {
                    targetOption = options.find(
                        (opt) => !opt.textContent.includes("Off")
                    );
                }
            } else {
                // Find "Off" option
                targetOption = Array.from(
                    document.querySelectorAll('[data-uia="track-list-item"]')
                ).find((opt) => opt.textContent.includes("Off"));
            }

            if (targetOption) {
                targetOption.click();
            }

            // If we enabled subtitles and want bilingual, set it up
            if (enabled && state.bilingualEnabled) {
                setTimeout(() => {
                    enableBilingualSubtitles();
                }, 500);
            }
        }, 300);
    } catch (error) {
        console.error("Error toggling subtitles:", error);
    }
}

/**
 * Enable bilingual subtitle display
 */
function enableBilingualSubtitles() {
    if (!state.subtitleEnabled) return;

    // Find Netflix's subtitle container
    const subtitleContainer = document.querySelector(".player-timedtext");
    if (!subtitleContainer) {
        console.error("Subtitle container not found");
        return;
    }

    // Completely override any existing positioning styles from Netflix
    if (subtitleContainer.style) {
        subtitleContainer.style.position = "fixed";
        subtitleContainer.style.bottom = "80px";
        subtitleContainer.style.top = "auto";
        subtitleContainer.style.left = "0";
        subtitleContainer.style.right = "0";
        subtitleContainer.style.transform = "none";
        subtitleContainer.style.zIndex = "9996";
    }

    // Set attribute for custom styling
    subtitleContainer.setAttribute("dual-subtitles", "true");

    // Store container reference
    state.subtitleContainer = subtitleContainer;

    // Set up MutationObserver to watch for subtitle changes
    if (!state.subtitleObserver) {
        state.subtitleObserver = new MutationObserver(handleSubtitleChange);
        state.subtitleObserver.observe(subtitleContainer, SUBTITLE_OBSERVER_CONFIG);
    }

    // Apply initial styles
    updateSubtitleStyles();

    // Try to set up tracks if we haven't already
    if (state.availableSubtitleTracks.length === 0) {
        state.availableSubtitleTracks = detectSubtitleTracks();
    }

    // Process any existing subtitles
    const existingSubtitle = subtitleContainer.querySelector(
        ".player-timedtext-text-container"
    );
    if (existingSubtitle) {
        processSubtitleElement(existingSubtitle).catch((err) => {
            console.error("Error processing existing subtitle:", err);
        });
    }

    showMessage("Bilingual Subtitles Enabled", 2000);
}

/**
 * Disable bilingual subtitle display
 */
function disableBilingualSubtitles() {
    if (state.subtitleObserver) {
        state.subtitleObserver.disconnect();
        state.subtitleObserver = null;
    }

    if (state.subtitleContainer) {
        state.subtitleContainer.removeAttribute("dual-subtitles");
        state.subtitleContainer = null;
    }

    // Find subtitle elements and restore them
    const subtitleElements = document.querySelectorAll(
        ".player-timedtext-text-container"
    );
    subtitleElements.forEach((element) => {
        // Remove dual subtitle formatting but keep original text
        const originalText = element.textContent;
        element.innerHTML = originalText;
    });

    showMessage("Bilingual Subtitles Disabled", 2000);
}

/**
 * Handle subtitle changes to show bilingual text
 * @param {MutationRecord[]} mutations - Mutation records from observer
 */
function handleSubtitleChange(mutations) {
    if (!state.bilingualEnabled) return;

    for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            // Check for added subtitle nodes
            const subtitleElement = mutation.target.querySelector(
                ".player-timedtext-text-container"
            );

            if (subtitleElement) {
                // Process subtitles asynchronously
                processSubtitleElement(subtitleElement).catch((err) => {
                    console.error("Error handling subtitle change:", err);
                });
            }
        }
    }
}

/**
 * Process a subtitle element to add secondary language
 * @param {HTMLElement} element - The subtitle element
 */
async function processSubtitleElement(element) {
    if (!element || !state.bilingualEnabled) return;

    // Get primary subtitle text
    const primaryText = element.textContent;

    try {
        // Rate limit translation requests
        const now = Date.now();
        const timeSinceLastRequest = now - state.lastTranslationRequest;

        if (timeSinceLastRequest < state.translationDelay) {
            await new Promise((resolve) =>
                setTimeout(resolve, state.translationDelay - timeSinceLastRequest)
            );
        }

        state.lastTranslationRequest = Date.now();

        // Translate using Google Translate
        const translation = await translateText(
            primaryText,
            state.primaryLanguage,
            state.secondaryLanguage
        );

        // Replace content with dual-language format and add wrapper div for better centering
        element.innerHTML = `
            <div style="width:100%; text-align:center;">
                <div class="primary-subtitle">${primaryText}</div>
                <div class="secondary-subtitle">${translation}</div>
            </div>
        `;

        // Ensure the element itself has proper styling
        element.style.textAlign = "center";
        element.style.width = "100%";
        element.style.maxWidth = "100%";
        element.style.left = "0";
        element.style.right = "0";
    } catch (error) {
        console.error("Error processing subtitle:", error);
        // In case of error, still show both but indicate translation failed
        element.innerHTML = `
            <div style="width:100%; text-align:center;">
                <div class="primary-subtitle">${primaryText}</div>
                <div class="secondary-subtitle">[Translation unavailable]</div>
            </div>
        `;
    }
}

/**
 * Update subtitle styles based on user settings
 */
function updateSubtitleStyles() {
    // Add or update CSS variables for subtitle styling
    const root = document.documentElement;
    root.style.setProperty("--primary-color", state.primaryColor);
    root.style.setProperty("--secondary-color", state.secondaryColor);
    root.style.setProperty(
        "--subtitle-bg-opacity",
        state.subtitleBackgroundOpacity
    );

    // Set size variables
    let sizeValue;
    switch (state.subtitleSize) {
        case "small":
            sizeValue = "var(--small-subtitle-size)";
            break;
        case "large":
            sizeValue = "var(--large-subtitle-size)";
            break;
        default:
            sizeValue = "var(--medium-subtitle-size)";
    }
    root.style.setProperty("--subtitle-size", sizeValue);
}

/**
 * Toggle subtitle settings panel visibility
 */
function toggleSubtitleSettings() {
    state.subtitleSettingsOpen = !state.subtitleSettingsOpen;

    if (!state.subtitleSettingsPanel) {
        state.subtitleSettingsPanel = createSubtitleSettings();
    }

    if (state.subtitleSettingsOpen) {
        state.subtitleSettingsPanel.classList.add("visible");

        // Don't hide controller when settings are open
        if (state.controllerHideTimer) {
            clearTimeout(state.controllerHideTimer);
            state.controllerHideTimer = null;
        }
    } else {
        state.subtitleSettingsPanel.classList.remove("visible");
        showController(); // Restart controller hide timer
    }
}

/**
 * Set up keyboard shortcuts globally for the entire website
 */
function setupKeyboardShortcuts() {
    // Remove any existing listeners to avoid duplicates
    if (state.keyboardListener) {
        document.removeEventListener("keydown", state.keyboardListener);
    }

    // Create the keyboard listener function
    state.keyboardListener = function (e) {
        // Only handle events if we're on a Netflix watch page
        if (!isOnNetflixWatch()) return;

        // Don't capture keyboard events if user is typing in an input field
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        // Always ensure video element is current
        const videoElement = document.querySelector("video");
        if (!videoElement) return;

        // Always show controller when key is pressed if the controller exists
        if (state.controllerElement) {
            showController();
        }

        // Handle all other keys normally
        switch (e.key) {
            case " ": // Spacebar - toggle play/pause
                e.preventDefault(); // Prevent page scrolling

                if (videoElement.paused) {
                    videoElement.play();
                    if (state.buttonPlayPause) {
                        state.buttonPlayPause.innerHTML =
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';
                    }
                } else {
                    videoElement.pause();
                    if (state.buttonPlayPause) {
                        state.buttonPlayPause.innerHTML =
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>';
                    }
                }
                break;
            case "ArrowLeft": // Left arrow - seek backward
                e.preventDefault(); // Prevent default browser scrolling
                e.stopPropagation(); // Stop event from being handled elsewhere
                sendSeekKeyToNetflix("left"); // Send the key to Netflix player
                break;

            case "ArrowRight": // Right arrow - seek forward
                e.preventDefault(); // Prevent default browser scrolling
                e.stopPropagation(); // Stop event from being handled elsewhere
                sendSeekKeyToNetflix("right"); // Send the key to Netflix player
                break;
            case "ArrowUp": // Up arrow - volume up
                e.preventDefault();
                videoElement.volume = Math.min(1, videoElement.volume + 0.1);
                if (state.volumeSlider) {
                    state.volumeSlider.value = videoElement.volume * 100;
                }
                showMessage(`Volume: ${Math.round(videoElement.volume * 100)}%`);
                break;

            case "ArrowDown": // Down arrow - volume down
                e.preventDefault();
                videoElement.volume = Math.max(0, videoElement.volume - 0.1);
                if (state.volumeSlider) {
                    state.volumeSlider.value = videoElement.volume * 100;
                }
                showMessage(`Volume: ${Math.round(videoElement.volume * 100)}%`);
                break;

            case "m": // M - toggle mute
            case "M":
                e.preventDefault();
                videoElement.muted = !videoElement.muted;
                const volumeIcon = document.getElementById("netflix-volume-icon");
                if (volumeIcon) {
                    volumeIcon.innerHTML = videoElement.muted
                        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L9.91 6.09 12 8.18M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.32 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9" fill="white"/></svg>'
                        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77 0-4.28-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9H3z" fill="white"/></svg>';
                }
                showMessage(videoElement.muted ? "Muted" : "Unmuted");
                break;

            case "f":
            case "F":
                e.preventDefault();
                e.stopPropagation();
                toggleFullScreen();
                showMessage(
                    document.fullscreenElement ? "Fullscreen Mode" : "Exit Fullscreen"
                );
                break;

            case "c": // C - toggle subtitles
            case "C":
                e.preventDefault();
                state.subtitleEnabled = !state.subtitleEnabled;
                toggleSubtitles(state.subtitleEnabled);
                showMessage(state.subtitleEnabled ? "Subtitles On" : "Subtitles Off");

                // Update settings panel if open
                if (state.subtitleSettingsPanel) {
                    state.subtitleSettingsPanel.querySelector(
                        "#subtitle-toggle-checkbox"
                    ).checked = state.subtitleEnabled;
                }
                break;

            case "b": // B - toggle bilingual subtitles
            case "B":
                e.preventDefault();
                e.stopPropagation();
                state.bilingualEnabled = !state.bilingualEnabled;

                if (state.bilingualEnabled) {
                    // Make sure subtitles are enabled first
                    if (!state.subtitleEnabled) {
                        state.subtitleEnabled = true;
                        toggleSubtitles(true);
                        // Update settings panel if open
                        if (state.subtitleSettingsPanel) {
                            state.subtitleSettingsPanel.querySelector(
                                "#subtitle-toggle-checkbox"
                            ).checked = true;
                        }
                    } else {
                        enableBilingualSubtitles();
                    }
                } else {
                    disableBilingualSubtitles();
                }

                // Update settings panel if open
                if (state.subtitleSettingsPanel) {
                    state.subtitleSettingsPanel.querySelector(
                        "#bilingual-toggle-checkbox"
                    ).checked = state.bilingualEnabled;
                }
                break;

            // Add other shortcuts as needed
        }
    };

    // Add the keyboard listener - DO NOT USE CAPTURE MODE for Arrow keys to work properly
    document.addEventListener("keydown", state.keyboardListener);

    // Set up key handler specifically for NetFlix's video element to monitor seeking progress
    const netflixSeekMonitor = (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            // Update our progress bar to match Netflix's seeking
            requestAnimationFrame(updateProgression);
        }
    };

    // Add this directly to the video element
    const videoElement = document.querySelector("video");
    if (videoElement) {
        videoElement.addEventListener("keydown", netflixSeekMonitor);

        // Also monitor seeking events
        videoElement.addEventListener("seeking", () => {
            requestAnimationFrame(updateProgression);
        });

        // And timeupdate events
        videoElement.addEventListener("timeupdate", () => {
            requestAnimationFrame(updateProgression);
        });
    }
}

function createSeekControls() {
    // Only add seek controls if they don't exist yet
    if (document.getElementById("netflix-seek-controls")) return;

    const seekControls = document.createElement("div");
    seekControls.id = "netflix-seek-controls";
    seekControls.style.position = "fixed";
    seekControls.style.bottom = "100px";
    seekControls.style.left = "50%";
    seekControls.style.transform = "translateX(-50%)";
    seekControls.style.display = "flex";
    seekControls.style.alignItems = "center";
    seekControls.style.gap = "10px";
    seekControls.style.zIndex = "10001";
    seekControls.style.opacity = "0";
    seekControls.style.transition = "opacity 0.3s ease";

    // Rewind button
    const rewindBtn = document.createElement("button");
    rewindBtn.textContent = "-10s";
    rewindBtn.style.backgroundColor = "rgba(0,0,0,0.7)";
    rewindBtn.style.color = "white";
    rewindBtn.style.border = "none";
    rewindBtn.style.borderRadius = "4px";
    rewindBtn.style.padding = "8px 12px";
    rewindBtn.style.cursor = "pointer";

    // Forward button
    const forwardBtn = document.createElement("button");
    forwardBtn.textContent = "+10s";
    forwardBtn.style.backgroundColor = "rgba(0,0,0,0.7)";
    forwardBtn.style.color = "white";
    forwardBtn.style.border = "none";
    forwardBtn.style.borderRadius = "4px";
    forwardBtn.style.padding = "8px 12px";
    forwardBtn.style.cursor = "pointer";

    // Add events
    rewindBtn.addEventListener("click", () => {
        // Simulate left arrow key press on Netflix player
        const video = document.querySelector("video");
        if (video) {
            const event = new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                code: "ArrowLeft",
                keyCode: 37,
                which: 37,
                bubbles: true,
            });
            video.dispatchEvent(event);
        }
    });

    forwardBtn.addEventListener("click", () => {
        // Simulate right arrow key press on Netflix player
        const video = document.querySelector("video");
        if (video) {
            const event = new KeyboardEvent("keydown", {
                key: "ArrowRight",
                code: "ArrowRight",
                keyCode: 39,
                which: 39,
                bubbles: true,
            });
            video.dispatchEvent(event);
        }
    });

    seekControls.appendChild(rewindBtn);
    seekControls.appendChild(forwardBtn);

    document.body.appendChild(seekControls);

    // Show seek controls when controller is visible
    const showSeekControls = () => {
        if (state.isControllerVisible) {
            seekControls.style.opacity = "1";
        } else {
            seekControls.style.opacity = "0";
        }
    };

    // Connect to controller visibility
    const controllerObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "class") {
                showSeekControls();
            }
        });
    });

    if (state.controllerElement) {
        controllerObserver.observe(state.controllerElement, { attributes: true });
    }

    return seekControls;
}

/**
 * Add to addMediaController function to include seek controls
 */
function setupSeekingSupport() {
    // Create on-screen seek controls
    createSeekControls();

    // Also make sure our progress bar is always synced with Netflix's playback
    const videoElement = document.querySelector("video");
    if (videoElement) {
        videoElement.addEventListener("timeupdate", () => {
            requestAnimationFrame(updateProgression);
        });

        videoElement.addEventListener("seeking", () => {
            requestAnimationFrame(updateProgression);
        });

        videoElement.addEventListener("seeked", () => {
            requestAnimationFrame(updateProgression);
        });
    }
}

/**
 * Find the Netflix player element and send keyboard events to it
 * @param {string} direction - 'left' or 'right'
 */
function sendSeekKeyToNetflix(direction) {
    // Find the Netflix player - using the class and data attribute you identified
    const netflixPlayer = document.querySelector('div[data-uia="player"]');

    if (!netflixPlayer) {
        console.error("Netflix player element not found");
        return;
    }

    // Store current active element to restore focus later
    const previouslyFocused = document.activeElement;

    // Focus the Netflix player element
    netflixPlayer.focus();

    // Short delay to ensure focus is established
    setTimeout(() => {
        // Create a keyboard event
        const keyEvent = new KeyboardEvent("keydown", {
            key: direction === "left" ? "ArrowLeft" : "ArrowRight",
            code: direction === "left" ? "ArrowLeft" : "ArrowRight",
            keyCode: direction === "left" ? 37 : 39,
            which: direction === "left" ? 37 : 39,
            bubbles: true,
            cancelable: true,
            view: window,
        });

        // Dispatch the event to the Netflix player
        netflixPlayer.dispatchEvent(keyEvent);

        // Show a message to indicate the action
        showMessage(direction === "left" ? "Rewind" : "Fast Forward");

        // Restore previous focus after a short delay
        setTimeout(() => {
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        }, 100);
    }, 50);
}

/**
 * Add video overlay with additional properties to help with focus management
 */
function createVideoOverlay() {
    // Create video overlay that allows clicks to pass through to Netflix controls
    state.videoOverlay = document.createElement("div");
    state.videoOverlay.id = "netflix-video-overlay";
    state.videoOverlay.style.pointerEvents = "none"; // Allow clicks to pass through to Netflix's controls

    // Make overlay focusable but visually unchanged
    state.videoOverlay.tabIndex = -1; // Make focusable without being in tab order
    state.videoOverlay.style.outline = "none"; // Remove focus outline

    // Ensure our overlay can intercept keyboard events
    state.videoOverlay.addEventListener("keydown", (e) => {
        // Pass the event to our global keyboard handler
        if (state.keyboardListener) {
            state.keyboardListener(e);
        }
    });

    document.body.appendChild(state.videoOverlay);
}

function createVideoAreaOverlay() {
    const videoAreaOverlay = document.createElement("div");
    videoAreaOverlay.id = "netflix-video-area-overlay";
    videoAreaOverlay.style.position = "fixed";
    videoAreaOverlay.style.top = "0";
    videoAreaOverlay.style.left = "0";
    videoAreaOverlay.style.width = "100%";
    videoAreaOverlay.style.height = "calc(100% - 140px)";
    videoAreaOverlay.style.zIndex = "9997";
    videoAreaOverlay.style.cursor = "pointer";
    videoAreaOverlay.style.backgroundColor = "transparent";

    // Make it focusable
    videoAreaOverlay.tabIndex = -1;
    videoAreaOverlay.style.outline = "none";

    // Handle play/pause toggle
    videoAreaOverlay.addEventListener("click", (e) => {
        // Prevent clicks on controller from triggering this
        if (
            !e.target.closest("#mon-controleur-netflix") &&
            !e.target.closest("#netflix-subtitle-settings")
        ) {
            if (state.videoElement.paused) {
                state.videoElement.play();
                if (state.buttonPlayPause) {
                    state.buttonPlayPause.innerHTML =
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';
                }
            } else {
                state.videoElement.pause();
                if (state.buttonPlayPause) {
                    state.buttonPlayPause.innerHTML =
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>';
                }
            }
        }
    });

    // Handle double-click for fullscreen
    videoAreaOverlay.addEventListener("dblclick", (e) => {
        // Prevent double-click on controller
        if (
            !e.target.closest("#mon-controleur-netflix") &&
            !e.target.closest("#netflix-subtitle-settings")
        ) {
            toggleFullScreen();
        }
    });

    document.body.appendChild(videoAreaOverlay);
    return videoAreaOverlay;
}

/**
 * Add the media controller to the page
 */
function addMediaController() {
    if (state.isControllerAdded) return;

    cleanController();

    state.videoElement = document.querySelector("video");
    if (!state.videoElement) return;

    createStylesIfNeeded();

    // Create enhanced video overlays for better focus management
    createVideoOverlay();
    const videoAreaOverlay = createVideoAreaOverlay();

    // Create controller element as before
    state.controllerElement = document.createElement("div");
    state.controllerElement.id = CONTROLLER_ID;

    // Make controller focusable too
    state.controllerElement.tabIndex = -1;
    state.controllerElement.style.outline = "none";

    // Create video overlay that allows clicks to pass through to Netflix controls
    state.videoOverlay = document.createElement("div");
    state.videoOverlay.id = "netflix-video-overlay";
    state.videoOverlay.style.pointerEvents = "none"; // Allow clicks to pass through to Netflix's controls

    // Create a separate overlay just for the video area (excluding controls)
    videoAreaOverlay.id = "netflix-video-area-overlay";
    videoAreaOverlay.style.position = "fixed";
    videoAreaOverlay.style.top = "0";
    videoAreaOverlay.style.left = "0";
    videoAreaOverlay.style.width = "100%";
    videoAreaOverlay.style.height = "calc(100% - 140px)"; // Exclude Netflix controls area
    videoAreaOverlay.style.zIndex = "9997";
    videoAreaOverlay.style.cursor = "pointer";
    videoAreaOverlay.style.backgroundColor = "transparent";

    state.controllerElement = document.createElement("div");
    state.controllerElement.id = CONTROLLER_ID;

    // Create container divs for better layout
    const controlsLeft = document.createElement("div");
    controlsLeft.className = "controls-left";

    const controlsCenter = document.createElement("div");
    controlsCenter.className = "controls-center";

    const controlsRight = document.createElement("div");
    controlsRight.className = "controls-right";

    state.buttonPlayPause = document.createElement("button");
    state.buttonPlayPause.id = "netflix-play-pause";
    state.buttonPlayPause.innerHTML = state.videoElement.paused
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';

    state.buttonFullScreen = document.createElement("button");
    state.buttonFullScreen.id = "netflix-plein-ecran";
    state.buttonFullScreen.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.59 5.59L18 7L12 13L6 7L7.41 5.59L12 10.17L16.59 5.59M16.59 18.41L12 13.83L7.41 18.41L6 17L12 11L18 17L16.59 18.41Z" fill="white"/></svg>';

    // Next
    const nextEpisodeButton = document.createElement("button");
    nextEpisodeButton.id = "netflix-next-episode";
    nextEpisodeButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" role="img" viewBox="0 0 24 24" width="24" height="24" data-icon="NextEpisodeStandard" aria-hidden="true"><path fill="white" d="M22 3H20V21H22V3ZM4.28615 3.61729C3.28674 3.00228 2 3.7213 2 4.89478V19.1052C2 20.2787 3.28674 20.9977 4.28615 20.3827L15.8321 13.2775C16.7839 12.6918 16.7839 11.3082 15.8321 10.7225L4.28615 3.61729ZM4 18.2104V5.78956L14.092 12L4 18.2104Z" clip-rule="evenodd" fill-rule="evenodd"></path></svg>';

    // Subtitle toggle button
    const subtitleToggle = document.createElement("button");
    subtitleToggle.id = "netflix-subtitle-toggle";
    subtitleToggle.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20,4H4C2.9,4 2,4.9 2,6V18C2,19.1 2.9,20 4,20H20C21.1,20 22,19.1 22,18V6C22,4.9 21.1,4 20,4M20,18H4V6H20V18M6,10H8V12H6V10M6,14H14V16H6V14M16,14H18V16H16V14M10,10H18V12H10Z" fill="white"/></svg>';

    // Bilingual subtitle toggle button
    const bilingualToggle = document.createElement("button");
    bilingualToggle.id = "netflix-bilingual-toggle";
    bilingualToggle.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.87 15.07L10.33 12.56L10.36 12.53C12.1 10.59 13.34 8.36 14.07 6H17V4H10V2H8V4H1V6H12.17C11.5 7.92 10.44 9.75 9 11.35C8.07 10.32 7.3 9.19 6.69 8H4.69C5.42 9.63 6.42 11.17 7.67 12.56L2.58 17.58L4 19L9 14L12.11 17.11L12.87 15.07M18.5 10H16.5L12 22H14L15.12 19H19.87L21 22H23L18.5 10M15.88 17L17.5 12.67L19.12 17H15.88Z" fill="white"/></svg>';

    const barreContainer = document.createElement("div");
    barreContainer.id = "netflix-barre-container";

    state.progressionBar = document.createElement("div");
    state.progressionBar.id = "netflix-barre-progression";

    state.screenTime = document.createElement("div");
    state.screenTime.id = "netflix-temps";

    // Volume control
    const volumeContainer = document.createElement("div");
    volumeContainer.id = "netflix-volume-container";

    const volumeIcon = document.createElement("div");
    volumeIcon.id = "netflix-volume-icon";
    volumeIcon.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77 0-4.28-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9H3z" fill="white"/></svg>';

    const volumeSliderContainer = document.createElement("div");
    volumeSliderContainer.id = "netflix-volume-slider-container";

    state.volumeSlider = document.createElement("input");
    state.volumeSlider.type = "range";
    state.volumeSlider.id = "netflix-volume-slider";
    state.volumeSlider.min = "0";
    state.volumeSlider.max = "100";
    state.volumeSlider.value = state.videoElement.volume * 100;

    const handleControlsClick = (e) => {
        if (
            e.target === state.buttonPlayPause ||
            e.target.closest("#netflix-play-pause")
        ) {
            if (state.videoElement.paused) {
                state.videoElement.play();
                state.buttonPlayPause.innerHTML =
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';
            } else {
                state.videoElement.pause();
                state.buttonPlayPause.innerHTML =
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>';
            }
        } else if (
            e.target === state.buttonFullScreen ||
            e.target.closest("#netflix-plein-ecran")
        ) {
            toggleFullScreen();
        } else if (
            e.target === volumeIcon ||
            e.target.closest("#netflix-volume-icon")
        ) {
            state.videoElement.muted = !state.videoElement.muted;
            volumeIcon.innerHTML = state.videoElement.muted
                ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L9.91 6.09 12 8.18M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.32 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9" fill="white"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77 0-4.28-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9H3z" fill="white"/></svg>';
        } else if(e.target === nextEpisodeButton || e.target.closest("#netflix-next-episode")) {
            // Trigger next episode action
            jumpToNextEpsode();
        } else if (
            e.target === subtitleToggle ||
            e.target.closest("#netflix-subtitle-toggle")
        ) {
            // Toggle subtitle settings panel
            toggleSubtitleSettings();
        } else if (
            e.target === bilingualToggle ||
            e.target.closest("#netflix-bilingual-toggle")
        ) {
            // Toggle bilingual subtitles directly
            state.bilingualEnabled = !state.bilingualEnabled;

            if (state.bilingualEnabled) {
                // Make sure subtitles are enabled first
                if (!state.subtitleEnabled) {
                    state.subtitleEnabled = true;
                    toggleSubtitles(true);

                    // Update settings panel if open
                    if (state.subtitleSettingsPanel) {
                        state.subtitleSettingsPanel.querySelector(
                            "#subtitle-toggle-checkbox"
                        ).checked = true;
                    }
                } else {
                    enableBilingualSubtitles();
                }
            } else {
                disableBilingualSubtitles();
            }

            // Update settings panel if open
            if (state.subtitleSettingsPanel) {
                state.subtitleSettingsPanel.querySelector(
                    "#bilingual-toggle-checkbox"
                ).checked = state.bilingualEnabled;
            }
        }
    };

    state.volumeSlider.addEventListener("input", (e) => {
        const volume = e.target.value / 100;
        state.videoElement.volume = volume;
        state.videoElement.muted = volume === 0;
        volumeIcon.innerHTML =
            volume === 0
                ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L9.91 6.09 12 8.18M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.32 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9" fill="white"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77 0-4.28-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9H3z" fill="white"/></svg>';
    });

    state.controllerElement.addEventListener("click", handleControlsClick);

    document.addEventListener("fullscreenchange", () => {
        if (state.buttonFullScreen) {
            state.buttonFullScreen.innerHTML = document.fullscreenElement
                ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 3.41L16.41 9L18 10.59L23.59 5L22 3.41M2 5L7.59 10.59L9.18 9L3.59 3.41L2 5M18 13.41L16.41 15L22 20.59L23.59 19L18 13.41M9.18 15L7.59 13.41L2 19L3.59 20.59L9.18 15Z" fill="white"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.59 5.59L18 7L12 13L7.41 18.41L6 17L12 11L18 17L16.59 18.41Z" fill="white"/></svg>';
        }
    });

    state.videoElement.addEventListener("play", () => {
        if (state.buttonPlayPause)
            state.buttonPlayPause.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';
        showController();
    });

    state.videoElement.addEventListener("pause", () => {
        if (state.buttonPlayPause)
            state.buttonPlayPause.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>';
        if (state.controllerElement) {
            state.controllerElement.classList.remove("hidden");
            state.isControllerVisible = true;
        }
    });

    setupKeyboardShortcuts();

    setTimeout(() => {
        if (videoAreaOverlay) {
            videoAreaOverlay.focus();
        }
    }, 500);

    // Prevent Netflix from stealing focus
    document.addEventListener("focusin", (e) => {
        if (
            state.isControllerAdded &&
            !e.target.closest("#mon-controleur-netflix") &&
            !e.target.closest("#netflix-subtitle-settings") &&
            e.target.tagName !== "INPUT" &&
            e.target.tagName !== "TEXTAREA" &&
            state.videoOverlay
        ) {
            // Wait to avoid focus fighting and only if not user-initiated
            if (!state.userInitiatedFocus) {
                setTimeout(() => {
                    state.videoOverlay.focus();
                }, 10);
            }
        }
    });

    // Track user-initiated focus
    document.addEventListener("mousedown", () => {
        state.userInitiatedFocus = true;
        setTimeout(() => {
            state.userInitiatedFocus = false;
        }, 100);
    });

    // Auto-hide controller after inactivity
    state.videoElement.addEventListener("mousemove", () => {
        showController();
    });

    document.addEventListener("mousemove", () => {
        showController();
    });

    // Add click event to overlay for play/pause toggle
    state.videoOverlay.addEventListener("click", (e) => {
        // Prevent clicks on controller from triggering this
        if (
            !e.target.closest("#mon-controleur-netflix") &&
            !e.target.closest("#netflix-subtitle-settings")
        ) {
            if (state.videoElement.paused) {
                state.videoElement.play();
                state.buttonPlayPause.innerHTML =
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 19H18V5H14V19ZM6 19H10V5H6V19Z" fill="white"/></svg>';
            } else {
                state.videoElement.pause();
                state.buttonPlayPause.innerHTML =
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="white"/></svg>';
            }
        }
    });

    // Set up keyboard shortcuts

    volumeSliderContainer.appendChild(state.volumeSlider);
    volumeContainer.appendChild(volumeIcon);
    volumeContainer.appendChild(volumeSliderContainer);

    barreContainer.appendChild(state.progressionBar);

    // Create a container for the progress bar to ensure vertical alignment
    const progressContainer = document.createElement("div");
    progressContainer.style.display = "flex";
    progressContainer.style.alignItems = "center"; // Center items vertically
    progressContainer.style.flex = "1";
    progressContainer.appendChild(barreContainer);

    // Organize controls
    controlsLeft.appendChild(state.buttonPlayPause);
    controlsLeft.appendChild(volumeContainer);
    controlsLeft.appendChild(state.screenTime);

    controlsRight.appendChild(nextEpisodeButton);
    controlsRight.appendChild(bilingualToggle);
    controlsRight.appendChild(subtitleToggle);
    controlsRight.appendChild(state.buttonFullScreen);

    state.controllerElement.appendChild(controlsLeft);
    state.controllerElement.appendChild(progressContainer);
    state.controllerElement.appendChild(controlsRight);

    // Add the overlay first, then the controller (so controller is on top)
    document.body.appendChild(state.videoOverlay);
    document.body.appendChild(state.controllerElement);
    state.isControllerAdded = true;

    updateProgression();

    const rafCallback = () => {
        updateProgression();
        if (state.controllerElement) {
            state.progressionIntervalId = requestAnimationFrame(rafCallback);
        }
    };
    state.progressionIntervalId = requestAnimationFrame(rafCallback);

    // Set up Event listener to allow seeking using progress bar
    barreContainer.addEventListener("click", (e) => {
        const rect = barreContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = (x / rect.width) * 100; // allows us to determine where user wants to seek to

        const totalVideoTime = Math.floor(state.videoElement.duration); // seconds
        const seekTime = Math.floor((percent / 100) * totalVideoTime * 1000); // ms

        // Send to injected script for custom seeking
        window.dispatchEvent(
            new CustomEvent("netflixSeekTo", { detail: seekTime })
        );
    });

    // Initial auto-hide if video is playing
    if (!state.videoElement.paused) {
        showController();
    }

    // Create subtitle settings panel
    state.subtitleSettingsPanel = createSubtitleSettings();

    // If subtitles were previously enabled, re-enable them
    if (state.subtitleEnabled) {
        // Short delay to allow Netflix to initialize
        setTimeout(() => {
            toggleSubtitles(true);

            // If bilingual was enabled, re-enable that as well
            setTimeout(() => {
                enableBilingualSubtitles();
            }, 1000);
        }, 1000);
    }

    // Create and add back button
    createBackButton();
}

/**
 * Remove elements by class name
 * @param {string[]} classesNames - Array of class names to remove
 */
function removeElementsByClasses(classesNames) {
    classesNames.forEach((className) => {
        const elementsToRemove = document.querySelectorAll(
            `[class*="${className}"]`
        );
        if (elementsToRemove.length > 0) {
            elementsToRemove.forEach((el) => el.remove());
        }
    });
}

/**
 * Main function to initialize or cleanup the controller
 */
function doYourJob() {
    if (isOnNetflixWatch()) {
        removeElementsByClasses(CLASSES_TO_REMOVE);

        // Use debounce technique to prevent multiple calls
        if (state.controllerTimerId) {
            clearTimeout(state.controllerTimerId);
        }

        state.controllerTimerId = setTimeout(() => {
            addMediaController();
            state.controllerTimerId = null;
        }, CONTROLLER_INIT_DELAY);
    } else {
        removeElementsByClasses(CLASSES_TO_REMOVE);
        cleanController();
    }
}

// Set up MutationObserver to detect DOM changes
const observerOptions = {
    childList: true,
    subtree: true,
};

const observer = new MutationObserver((mutations) => {
    if (state.mutationTimeout) clearTimeout(state.mutationTimeout);

    state.mutationTimeout = setTimeout(() => {
        const hasRelevantChanges = mutations.some((mutation) => {
            return Array.from(mutation.addedNodes).some((node) => {
                if (node.nodeName === "VIDEO") return true;

                // Check if relevant to our controller
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // More robust class checking
                    const nodeClassName = node.className || "";
                    return (
                        node.querySelector("video") ||
                        CLASSES_TO_REMOVE.some(
                            (c) =>
                                typeof nodeClassName === "string" && nodeClassName.includes(c)
                        )
                    );
                }
                return false;
            });
        });

        if (hasRelevantChanges || !state.isControllerAdded) {
            doYourJob();
        }
    }, 100); // Debounce time
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        setupKeyboardShortcuts();

        observer.observe(document.body, observerOptions);
        doYourJob();
    });
} else {
    setupKeyboardShortcuts();

    observer.observe(document.body, observerOptions);
    doYourJob();
}

/**
 * Create and add back button to exit Netflix video player
 */
function createBackButton() {
    if (state.backButton) return; // Don't create if it already exists

    state.backButton = document.createElement("button");
    state.backButton.id = "netflix-back-button";
    state.backButton.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="white"/></svg>';

    // Style the back button
    state.backButton.style.position = "fixed";
    state.backButton.style.top = "20px";
    state.backButton.style.left = "20px";
    state.backButton.style.zIndex = "10000";
    state.backButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    state.backButton.style.border = "none";
    state.backButton.style.borderRadius = "50%";
    state.backButton.style.width = "40px";
    state.backButton.style.height = "40px";
    state.backButton.style.cursor = "pointer";
    state.backButton.style.display = "flex";
    state.backButton.style.alignItems = "center";
    state.backButton.style.justifyContent = "center";
    state.backButton.style.transition = "all 0.2s ease, opacity 0.3s ease";
    state.backButton.style.opacity = "0"; // Start hidden and fade in

    // Add hover effect
    state.backButton.addEventListener("mouseover", () => {
        state.backButton.style.backgroundColor = "rgba(229, 9, 20, 0.8)";
        state.backButton.style.transform = "scale(1.1)";
    });

    state.backButton.addEventListener("mouseout", () => {
        state.backButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
        state.backButton.style.transform = "scale(1)";
    });

    // Add click event to exit Netflix player
    state.backButton.addEventListener("click", () => {
        // Try multiple approaches to exit the Netflix video player

        // Approach 1: Look for Netflix's own back button and click it
        const netflixBackButton =
            document.querySelector('button[data-uia="player-back-to-browse"]') ||
            document.querySelector(".button-nfplayerBack") ||
            document.querySelector("button.nf-player-container button") ||
            document.querySelector('button[aria-label="Back to Browse"]');

        if (netflixBackButton) {
            netflixBackButton.click();
            return;
        }

        // Approach 2: Simulate Escape key press (commonly exits fullscreen video players)
        const escKeyEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
        });

        document.body.dispatchEvent(escKeyEvent);

        // Approach 3: Look for back button within specific Netflix player containers
        const playerContainer =
            document.querySelector(".nf-player-container") ||
            document.querySelector(".watch-video--player-view");

        if (playerContainer) {
            const backBtn = playerContainer.querySelector("button");
            if (backBtn) {
                backBtn.click();
                return;
            }
        }

        // Approach 4: As a fallback, try to return to the browse page
        const currentUrl = window.location.href;
        if (currentUrl.includes("netflix.com/watch/")) {
            window.location.href = "https://www.netflix.com/browse";
        }
    });

    document.body.appendChild(state.backButton);

    // Fade in after a small delay
    setTimeout(() => {
        state.backButton.style.opacity = "1";
    }, 300);

    // Show/hide with controller visibility
    const updateBackButtonVisibility = () => {
        if (state.isControllerVisible) {
            state.backButton.style.opacity = "1";
        } else {
            state.backButton.style.opacity = "0";
        }
    };

    // Connect to controller visibility changes
    const originalShowController = showController;
    showController = function () {
        originalShowController();
        updateBackButtonVisibility();
    };

    // Handle controller hide timer completion
    const originalControllerHideTimer = state.controllerHideTimer;
    if (originalControllerHideTimer) {
        clearTimeout(originalControllerHideTimer);
        state.controllerHideTimer = setTimeout(() => {
            if (
                state.controllerElement &&
                !state.videoElement.paused &&
                !state.subtitleSettingsOpen
            ) {
                state.controllerElement.classList.add("hidden");
                state.isControllerVisible = false;
                updateBackButtonVisibility();
            }
        }, CONTROLLER_HIDE_DELAY);
    }
}

function getIdFromUrl() {
  const url = window.location.href;
  const parts = url.split('/');
  const watchIndex = parts.indexOf('watch');
  if (watchIndex !== -1 && watchIndex + 1 < parts.length) {
    return parts[watchIndex + 1].split('?')[0];
  }
  return null;
}

function jumpToNextEpsode() {
    const curEpisodeId = getIdFromUrl();
    if(curEpisodeId) {
        fetch(`https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=${curEpisodeId}`, {
            credentials: "include", // Important: includes your session cookies
          })
            .then(response => response.json())
            .then(response => {
                const episodes = response.video.seasons.reduce((acc, season) => {
                    if (season.episodes) {
                      acc.push(...season.episodes);
                    }
                    return acc;
                  }, []);
                  console.log("cur: ",curEpisodeId);
                  const curEpisodeIndex = episodes.findIndex(episode => episode.id.toString() === curEpisodeId);
                  if(curEpisodeIndex === -1) {
                    console.log("Current episode not found");
                    return;
                  }
                  const nextEpisode = episodes[curEpisodeIndex + 1] || null;
                    if (nextEpisode) {
                        const nextEpisodeId = nextEpisode.id;
                        const nextEpisodeUrl = `https://www.netflix.com/watch/${nextEpisodeId}`;
                        window.location.href = nextEpisodeUrl;
                    } else {
                        console.log("No next episode found");
                    }
                  console.log(nextEpisode);
            })
            .catch(error => console.error("Error fetching metadata:", error));
    }

    console.log("Next episode triggered....");
}