(function() {
    function getQueryParam(param) {
      const scriptElement = document.currentScript;
      const scriptUrl = new URL(scriptElement.src);
      const urlParams = new URLSearchParams(scriptUrl.search);
      return urlParams.get(param);
    }
  
    const seekTime = parseInt(getQueryParam('seekTime'), 10);
  
    try {
      const videoPlayer = netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
      const sessionIds = videoPlayer?.getAllPlayerSessionIds();
      if (sessionIds?.length) {
        const player = videoPlayer.getVideoPlayerBySessionId(sessionIds[0]);
        player.seek(seekTime);
        console.log('Seeked to:', player.getCurrentTime());
      } else {
        console.error('No player session found.');
      }
    } catch (err) {
      console.error('Error seeking video:', err);
    }
  })();