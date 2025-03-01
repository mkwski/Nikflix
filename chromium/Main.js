const CLASSES_TO_REMOVE = ["layout-item_styles__zc08zp30 default-ltr-cache-7vbe6a ermvlvv0", "default-ltr-cache-1sfbp89 e1qcljkj0", "css-1nym653 modal-enter-done", "nf-modal interstitial-full-screen"];


let state = {
    progressionIntervalId: null,
    controllerElement: null,
    buttonPlayPause: null,
    buttonFullScreen: null,
    progressionBar: null,
    screenTime: null,
    videoElement: null,
    lastScreenTime: -1,
    lastTotalTime: -1,
    isControllerAdded: false
};


const CONTROLLER_ID = 'mon-controleur-netflix';
const NETFLIX_WATCH_REGEX = /^https:\/\/www\.netflix\.com\/watch\/\d+/;
const CONTROLLER_INIT_DELAY = 1500; // Reduced from 3000ms


function isOnNetflixWatch() {
    return NETFLIX_WATCH_REGEX.test(window.location.href);
}


function timeFormat(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}


function updateProgression() {
    const { videoElement, progressionBar, screenTime } = state;

    if (!videoElement || !progressionBar || !screenTime) return;


    if (videoElement.duration) {
        const percentage = (videoElement.currentTime / videoElement.duration) * 100;
        progressionBar.style.width = `${percentage}%`;

        const currentTime = Math.floor(videoElement.currentTime);
        const totalTime = Math.floor(videoElement.duration);


        if (state.lastScreenTime !== currentTime || state.lastTotalTime !== totalTime) {
            state.lastScreenTime = currentTime;
            state.lastTotalTime = totalTime;
            screenTime.textContent = `${timeFormat(currentTime)} / ${timeFormat(totalTime)}`;
        }
    }
}


function toggleFullScreen() {
    const container = document.querySelector('.netflix-player');
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
        state.buttonFullScreen.innerHTML = '⤓';
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
        state.buttonFullScreen.innerHTML = '⤢';
    }
}


function createStylesIfNeeded() {
    if (!document.getElementById('netflix-controller-styles')) {
        const style = document.createElement('style');
        style.id = 'netflix-controller-styles';
        style.textContent = `
      #mon-controleur-netflix {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        transform: translateZ(0); 
        will-change: transform; 
        pointer-events: auto;
      }
      #netflix-play-pause, #netflix-plein-ecran {
        background-color: #e50914;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        margin-right: 10px;
        cursor: pointer;
        font-size: 16px;
        min-width: 40px;
        text-align: center;
      }
      #netflix-barre-container {
        flex: 1;
        height: 10px;
        background-color: #333;
        border-radius: 5px;
        overflow: hidden;
        cursor: pointer;
      }
      #netflix-barre-progression {
        height: 100%;
        background-color: #e50914;
        width: 0%;
        will-change: width; 
        transform: translateZ(0); 
      }
      #netflix-temps {
        margin-left: 10px;
        width: 120px;
        font:bold;
        text-align: center;
      }
    `;
        document.getElementById("appMountPoint").appendChild(style);
    }
}


function cleanController() {
    if (state.progressionIntervalId) {
        cancelAnimationFrame(state.progressionIntervalId);
        state.progressionIntervalId = null;
    }

    if (state.controllerElement) {
        state.controllerElement.remove();
    }

    state = {
        ...state,
        controllerElement: null,
        buttonPlayPause: null,
        buttonFullScreen: null,
        progressionBar: null,
        screenTime: null,
        videoElement: null,
        isControllerAdded: false
    };
}


function addMediaController() {

    if (state.isControllerAdded) return;


    cleanController();


    state.videoElement = document.querySelector('video');
    if (!state.videoElement) return;


    createStylesIfNeeded();


    state.controllerElement = document.createElement('div');
    state.controllerElement.id = CONTROLLER_ID;


    state.buttonPlayPause = document.createElement('button');
    state.buttonPlayPause.id = 'netflix-play-pause';
    state.buttonPlayPause.textContent = state.videoElement.paused ? '▶' : '⏸';


    state.buttonFullScreen = document.createElement('button');
    state.buttonFullScreen.id = 'netflix-plein-ecran';
    state.buttonFullScreen.innerHTML = '⤢';

    const barreContainer = document.createElement('div');
    barreContainer.id = 'netflix-barre-container';


    state.progressionBar = document.createElement('div');
    state.progressionBar.id = 'netflix-barre-progression';


    state.screenTime = document.createElement('div');
    state.screenTime.id = 'netflix-temps';


    const handleControlsClick = (e) => {
        if (e.target === state.buttonPlayPause) {
            if (state.videoElement.paused) {
                state.videoElement.play();
                state.buttonPlayPause.innerHTML = '⏸';
            } else {
                state.videoElement.pause();
                state.buttonPlayPause.innerHTML = '▶';
            }
        } else if (e.target === state.buttonFullScreen) {
            toggleFullScreen();
        }
    };

    state.controllerElement.addEventListener('click', handleControlsClick);


    document.addEventListener('fullscreenchange', () => {
        if (state.buttonFullScreen) {
            state.buttonFullScreen.textContent = document.fullscreenElement ? '⤓' : '⤢';
        }
    });


    state.videoElement.addEventListener('play', () => {
        if (state.buttonPlayPause) state.buttonPlayPause.innerHTML = '⏸';
    });

    state.videoElement.addEventListener('pause', () => {
        if (state.buttonPlayPause) state.buttonPlayPause.innerHTML = '▶';
    });

    barreContainer.appendChild(state.progressionBar);
    state.controllerElement.appendChild(state.buttonPlayPause);
    state.controllerElement.appendChild(state.buttonFullScreen);
    state.controllerElement.appendChild(barreContainer);
    state.controllerElement.appendChild(state.screenTime);

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
}


function removeElementsByClasses(classesNames) {

    const elementsToRemove = [];

    classesNames.forEach(className => {
        document.querySelectorAll(`[class*="${className}"]`).forEach(el => {
            elementsToRemove.push(el);
        });
    });


    elementsToRemove.forEach(el => el.remove());
}


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


const observerOptions = {
    childList: true,
    subtree: true
};

let mutationTimeout = null;
const observer = new MutationObserver((mutations) => {

    if (mutationTimeout) clearTimeout(mutationTimeout);

    mutationTimeout = setTimeout(() => {

        const hasRelevantChanges = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeName === 'VIDEO') return true;

                // Check if relevant to our controller
                if (node.nodeType === Node.ELEMENT_NODE) {
                    return node.querySelector('video') ||
                        CLASSES_TO_REMOVE.some(c => node.className && node.className.includes(c));
                }
                return false;
            });
        });

        if (hasRelevantChanges || !state.isControllerAdded) {
            doYourJob();
        }
    }, 100); // Debounce time
});


if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, observerOptions);
        doYourJob();
    });
} else {
    observer.observe(document.body, observerOptions);
    doYourJob();
}