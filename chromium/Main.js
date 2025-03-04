const CLASSES_TO_REMOVE = ["layout-item_styles__zc08zp30 default-ltr-cache-7vbe6a ermvlvv0", "default-ltr-cache-1sfbp89 e1qcljkj0", "css-1nym653 modal-enter-done", "nf-modal interstitial-full-screen"];


let state = {
    progressionIntervalId: null,
    controllerElement: null,
    buttonPlayPause: null,
    buttonFullScreen: null,
    progressionBar: null,
    screenTime: null,
    videoElement: null,
    volumeSlider:null,
    lastScreenTime: -1,
    lastTotalTime: -1,
    isControllerAdded: false,
    mutationTimeout: null,
    controllerTimerId: null
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
    justify-content: space-between;
    font-family: Arial, sans-serif;
    transform: translateZ(0); 
    will-change: transform; 
    pointer-events: auto;
}

#netflix-play-pause, 
#netflix-plein-ecran {
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
    transition: background-color 0.3s ease;
}

#netflix-play-pause:hover, 
#netflix-plein-ecran:hover {
    background-color: #f6121d;
}

#netflix-barre-container {
    flex: 1;
    height: 10px;
    background-color: #333;
    border-radius: 5px;
    overflow: hidden;
    cursor: pointer;
    margin: 0 15px;
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
    width: auto; 
    font-weight: bold;
    font-size: 13px;
    text-align: center;
    min-width: 70px;
}

#netflix-volume-container {
    display: flex;
    align-items: center;
    margin-left: 10px;
}

#netflix-volume-icon {
    margin-right: 10px;
    cursor: pointer;
    transition: transform 0.2s ease;
}

#netflix-volume-icon:hover {
    transform: scale(1.1);
}

#netflix-volume-slider {
    width: 100px;
    height: 5px;
    background-color: #333;
    border-radius: 5px;
    outline: none;
    opacity: 0.7;
    transition: opacity 0.2s, background-color 0.2s;
}

#netflix-volume-slider:hover {
    opacity: 1;
    background-color: #444;
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
        volumeSlider: null,
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

    //volume controle
    const volumeContainer = document.createElement('div');
    volumeContainer.id = 'netflix-volume-container';

    const volumeIcon = document.createElement('span');
    volumeIcon.id = 'netflix-volume-icon';
    volumeIcon.textContent = '🔊';

    state.volumeSlider = document.createElement('input');
    state.volumeSlider.type = 'range';
    state.volumeSlider.id = 'netflix-volume-slider';
    state.volumeSlider.min = '0';
    state.volumeSlider.max = '100';
    state.volumeSlider.value = state.videoElement.volume * 100;


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
        } else if (e.target === volumeIcon) {
            state.videoElement.muted = !state.videoElement.muted;
            volumeIcon.textContent = state.videoElement.muted ? '🔇' : '🔊';
        }
    };

    state.volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        state.videoElement.volume = volume;
        volumeIcon.textContent = volume === 0 ? '🔇' : '🔊';
    });

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


    volumeContainer.appendChild(volumeIcon);
    volumeContainer.appendChild(state.volumeSlider);

    barreContainer.appendChild(state.progressionBar);
    state.controllerElement.appendChild(state.buttonPlayPause);
    state.controllerElement.appendChild(state.buttonFullScreen);
    state.controllerElement.appendChild(barreContainer);
    state.controllerElement.appendChild(state.screenTime);
    state.controllerElement.appendChild(volumeContainer);

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
        const elementsToRemove = document.querySelectorAll(`[class*="${className}"]`);
        if (elementsToRemove.length > 0) {
            elementsToRemove.forEach(el => el.remove());
        }
    });
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

const observer = new MutationObserver((mutations) => {
    if (state.mutationTimeout) clearTimeout(state.mutationTimeout);

    state.mutationTimeout = setTimeout(() => {
        const hasRelevantChanges = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeName === 'VIDEO') return true;

                // Check if relevant to our controller
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // More robust class checking
                    const nodeClassName = node.className || '';
                    return node.querySelector('video') ||
                        CLASSES_TO_REMOVE.some(c =>
                            typeof nodeClassName === 'string' &&
                            nodeClassName.includes(c)
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


if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, observerOptions);
        doYourJob();
    });
} else {
    observer.observe(document.body, observerOptions);
    doYourJob();
}