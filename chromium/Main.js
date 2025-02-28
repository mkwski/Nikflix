

const classesToRemove = ["layout-item_styles__zc08zp30 default-ltr-cache-7vbe6a ermvlvv0", "default-ltr-cache-1sfbp89 e1qcljkj0", "css-1nym653 modal-enter-done","nf-modal interstitial-full-screen"];
//Variables
let progressionIntervalId = null;
let controllerElement = null;
let buttonPlayPause = null ;
let buttonFullScreen = null;
let progressionBar = null;
let screenTime = null;
let videoElement= null;


function isOnNetflixWatch() {
    return /^https:\/\/www\.netflix\.com\/watch\/\d+/.test(window.location.href);
}

//Controller

function timeFormat(timeInSecond) {
    const minutes = Math.floor(timeInSecond / 60);
    const secondes = Math.floor(timeInSecond % 60);
    return `${minutes.toString().padStart(2, '0')}:${secondes.toString().padStart(2, '0')}`;
}

function updateProgression() {
    if (!videoElement || !progressionBar || !screenTime) return;

    requestAnimationFrame(() => {
        if (videoElement.duration) {
            const pourcentage = (videoElement.currentTime / videoElement.duration) * 100;
            progressionBar.style.width = `${pourcentage}%`;

            const actuelTime = Math.floor(videoElement.currentTime);
            const totalTime = Math.floor(videoElement.duration);

            if (screenTime._lastScreenTime !== actuelTime ||
                screenTime._lastTotalTime !== totalTime) {

                screenTime._lastScreenTime = actuelTime;
                screenTime._lastTotalTime = totalTime;

                screenTime.textContent = `${timeFormat(actuelTime)} / ${timeFormat(totalTime)}`;
            }
        }
    });
}

function toggleFullScreen () {
    const container = document.querySelector('.netflix-player');
    const elementPourPleinEcran = container || videoElement;
    if (!elementPourPleinEcran) return;
    if (!document.fullscreenElement) {
        if (elementPourPleinEcran.requestFullscreen) {
            elementPourPleinEcran.requestFullscreen();
        } else if (elementPourPleinEcran.mozRequestFullScreen) { // Firefox
            elementPourPleinEcran.mozRequestFullScreen();
        } else if (elementPourPleinEcran.webkitRequestFullscreen) { // Chrome, Safari, Opera
            elementPourPleinEcran.webkitRequestFullscreen();
        } else if (elementPourPleinEcran.msRequestFullscreen) { // IE/Edge
            elementPourPleinEcran.msRequestFullscreen();
        }
        buttonFullScreen.innerHTML = '⤓';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
        buttonFullScreen.innerHTML = '⤢';
    }
}

function addMediaController () {
    cleanControleur();
    videoElement = document.querySelector('video');
    if (!videoElement) return;
    controllerElement = document.createElement('div');
    controllerElement.id = 'mon-controleur-netflix';


    const style = document.createElement('style');
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
            text-align: center;
        }
    `;
    document.getElementById("appMountPoint").appendChild(style);
    buttonPlayPause = document.createElement('button');
    buttonPlayPause.id = 'netflix-play-pause';
    buttonPlayPause.innerHTML = videoElement.paused ? '▶' : '⏸';


    buttonFullScreen = document.createElement('button');
    buttonFullScreen.id = 'netflix-plein-ecran';
    buttonFullScreen.innerHTML = '⤢';

    const barreContainer = document.createElement('div');
    barreContainer.id = 'netflix-barre-container';

    progressionBar = document.createElement('div');
    progressionBar.id = 'netflix-barre-progression';

    screenTime = document.createElement('div');
    screenTime.id = 'netflix-temps';

    screenTime._dernierTempsActuel = -1;
    screenTime._dernierTempsTotal = -1;


    buttonPlayPause.addEventListener('click', () => {
        if (videoElement.paused) {
            videoElement.play();
            buttonPlayPause.innerHTML = '⏸';
        } else {
            videoElement.pause();
            buttonPlayPause.innerHTML = '▶';
        }
    });

    buttonFullScreen.addEventListener('click', toggleFullScreen);

    document.addEventListener('fullscreenchange', () => {
        if (buttonFullScreen) {
            buttonFullScreen.innerHTML = document.fullscreenElement ? '⤓' : '⤢';
        }
    });


    videoElement.addEventListener('play', () => {
        if (buttonPlayPause) buttonPlayPause.innerHTML = '⏸';
    });

    videoElement.addEventListener('pause', () => {
        if (buttonPlayPause) buttonPlayPause.innerHTML = '▶';
    });

    barreContainer.appendChild(progressionBar);
    controllerElement.appendChild(buttonPlayPause);
    controllerElement.appendChild(buttonFullScreen);
    controllerElement.appendChild(barreContainer);
    controllerElement.appendChild(screenTime);


    document.body.appendChild(controllerElement);


    updateProgression();


    const rafCallback = () => {
        updateProgression();
        if (controllerElement) {
            progressionIntervalId = requestAnimationFrame(rafCallback);
        }
    };
    progressionIntervalId = requestAnimationFrame(rafCallback);

}
function cleanControleur() {
    if (progressionIntervalId) {
        cancelAnimationFrame(progressionIntervalId);
        progressionIntervalId = null;
    }

    if (controllerElement) {
        controllerElement.remove();
        controllerElement = null;
    }

    buttonPlayPause = null;
    buttonFullScreen = null;
    progressionBar = null;
    screenTime = null;
    videoElement = null;
}


//remove classes
function removeElementsByClasses(classesName) {
    classesName.forEach(classe => {
        document.querySelectorAll(`[class*="${classe}"]`).forEach(el => {
            el.remove();
        });
    });
}

//extension job
function doYourJob () {
    if (isOnNetflixWatch()) {
        removeElementsByClasses(classesToRemove);
        setTimeout(() => {
            addMediaController();
        }, 3000);
    } else {
        removeElementsByClasses(classesToRemove);
    }
}

const observer = new MutationObserver(() => {
    doYourJob();
});
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", () => {
    doYourJob();
});