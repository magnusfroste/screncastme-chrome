let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let webcamStream = null;
let combinedStream = null;
let webcamOverlay = null;
let areaSelector = null;
let selectedArea = null;
let recordingIndicator = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'ping':
      sendResponse({ success: true });
      return true;
      
    case 'initRecording':
      initRecording(message.streamId, message.options)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
      
    case 'selectArea':
      showAreaSelector(message.options)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
      
    case 'stopRecording':
      stopRecording()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
  }
});

async function initRecording(streamId, options) {
  try {
    // Request webcam FIRST (before screen capture) to ensure permission prompt shows
    if (options.withWebcam) {
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 320 }, 
            facingMode: 'user',
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        });
        createWebcamOverlay(options.webcamPosition);
      } catch (err) {
        console.warn('Could not access webcam:', err);
        alert('Could not access webcam. Please check camera permissions.');
      }
    }

    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      },
      audio: options.withAudio ? {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      } : false
    };

    screenStream = await navigator.mediaDevices.getUserMedia(constraints);

    await startRecording(options);
    chrome.runtime.sendMessage({ action: 'recordingStarted' });
    
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createWebcamOverlay(position) {
  if (webcamOverlay) {
    webcamOverlay.remove();
  }

  webcamOverlay = document.createElement('div');
  webcamOverlay.id = 'screen-recorder-webcam-overlay';
  webcamOverlay.className = `webcam-overlay ${position}`;
  
  const video = document.createElement('video');
  video.srcObject = webcamStream;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  
  // Ensure video plays on Mac
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.play().catch(err => console.warn('Video play failed:', err));
  
  webcamOverlay.appendChild(video);
  document.body.appendChild(webcamOverlay);

  makeDraggable(webcamOverlay);
}

function showRecordingIndicator() {
  if (recordingIndicator) return;
  
  recordingIndicator = document.createElement('div');
  recordingIndicator.id = 'screen-recorder-recording-indicator';
  recordingIndicator.textContent = 'Recording';
  document.body.appendChild(recordingIndicator);
}

function hideRecordingIndicator() {
  if (recordingIndicator) {
    recordingIndicator.remove();
    recordingIndicator = null;
  }
}

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    element.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.left = `${initialX + dx}px`;
    element.style.top = `${initialY + dy}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    if (element) {
      element.style.cursor = 'grab';
    }
  });
}

async function showAreaSelector(options) {
  return new Promise((resolve, reject) => {
    // Request webcam first if needed
    if (options.withWebcam && !webcamStream) {
      navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: 'user', frameRate: { ideal: 30, max: 30 } },
        audio: false
      }).then(stream => {
        webcamStream = stream;
        createWebcamOverlay(options.webcamPosition);
      }).catch(err => {
        console.warn('Could not access webcam:', err);
      });
    }

    areaSelector = document.createElement('div');
    areaSelector.id = 'screen-recorder-area-selector';
    areaSelector.innerHTML = `
      <div class="area-overlay"></div>
      <div class="area-selection"></div>
      <div class="area-instructions">Click and drag to select recording area<br><small>Press ESC to cancel</small></div>
    `;
    document.body.appendChild(areaSelector);

    const overlay = areaSelector.querySelector('.area-overlay');
    const selection = areaSelector.querySelector('.area-selection');
    let isSelecting = false;
    let startX, startY;

    const cleanup = () => {
      if (areaSelector) {
        areaSelector.remove();
        areaSelector = null;
      }
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        reject(new Error('Cancelled'));
      }
    };
    document.addEventListener('keydown', escHandler);

    overlay.addEventListener('mousedown', (e) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = '0';
      selection.style.height = '0';
      selection.style.display = 'block';
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      
      const width = e.clientX - startX;
      const height = e.clientY - startY;
      
      selection.style.width = `${Math.abs(width)}px`;
      selection.style.height = `${Math.abs(height)}px`;
      selection.style.left = `${width < 0 ? e.clientX : startX}px`;
      selection.style.top = `${height < 0 ? e.clientY : startY}px`;
    });

    overlay.addEventListener('mouseup', async (e) => {
      if (!isSelecting) return;
      isSelecting = false;

      const rect = selection.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) {
        cleanup();
        reject(new Error('Selection too small. Please select a larger area.'));
        return;
      }

      selectedArea = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };

      cleanup();

      // Store options for later use
      const storedOptions = { ...options, selectedArea };
      
      // Now trigger screen capture selection
      chrome.runtime.sendMessage({
        action: 'startRecording',
        options: storedOptions
      }, response => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || 'Failed to start recording'));
        }
      });
    });
  });
}

async function startRecording(options) {
  recordedChunks = [];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  
  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenStream;
  screenVideo.muted = true;
  await screenVideo.play();

  const screenWidth = screenVideo.videoWidth;
  const screenHeight = screenVideo.videoHeight;
  
  canvas.width = selectedArea ? selectedArea.width : screenWidth;
  canvas.height = selectedArea ? selectedArea.height : screenHeight;

  let webcamVideo = null;
  if (webcamStream) {
    webcamVideo = document.createElement('video');
    webcamVideo.srcObject = webcamStream;
    webcamVideo.muted = true;
    webcamVideo.playsInline = true;
    await webcamVideo.play();
  }

  const webcamSize = 150;
  const padding = 20;
  
  // Pre-calculate webcam crop values once
  let webcamCrop = null;
  if (webcamVideo) {
    const videoAspect = webcamVideo.videoWidth / webcamVideo.videoHeight;
    if (videoAspect > 1) {
      webcamCrop = {
        sx: (webcamVideo.videoWidth - webcamVideo.videoHeight) / 2,
        sy: 0,
        sw: webcamVideo.videoHeight,
        sh: webcamVideo.videoHeight
      };
    } else {
      webcamCrop = {
        sx: 0,
        sy: (webcamVideo.videoHeight - webcamVideo.videoWidth) / 2,
        sw: webcamVideo.videoWidth,
        sh: webcamVideo.videoWidth
      };
    }
  }

  function getWebcamPosition(pos) {
    const positions = {
      'top-left': { x: padding, y: padding },
      'top-right': { x: canvas.width - webcamSize - padding, y: padding },
      'bottom-left': { x: padding, y: canvas.height - webcamSize - padding },
      'bottom-right': { x: canvas.width - webcamSize - padding, y: canvas.height - webcamSize - padding }
    };
    return positions[pos] || positions['bottom-right'];
  }

  function drawFrame() {
    if (selectedArea) {
      ctx.drawImage(
        screenVideo,
        selectedArea.x * (screenWidth / window.innerWidth),
        selectedArea.y * (screenHeight / window.innerHeight),
        selectedArea.width * (screenWidth / window.innerWidth),
        selectedArea.height * (screenHeight / window.innerHeight),
        0, 0, canvas.width, canvas.height
      );
    } else {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    }

    if (webcamVideo && options.withWebcam && webcamCrop) {
      const pos = getWebcamPosition(options.webcamPosition);
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x + webcamSize / 2, pos.y + webcamSize / 2, webcamSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      ctx.drawImage(webcamVideo, webcamCrop.sx, webcamCrop.sy, webcamCrop.sw, webcamCrop.sh, pos.x, pos.y, webcamSize, webcamSize);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pos.x + webcamSize / 2, pos.y + webcamSize / 2, webcamSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      requestAnimationFrame(drawFrame);
    }
  }

  combinedStream = canvas.captureStream(30);

  if (options.withAudio) {
    const audioTracks = screenStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioTracks.forEach(track => {
        combinedStream.addTrack(track);
      });
      console.log('Audio track added:', audioTracks[0].label);
    } else {
      console.warn('No audio track available. Make sure to check "Share audio" in the sharing dialog.');
    }
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
    ? 'video/webm;codecs=vp9,opus' 
    : 'video/webm;codecs=vp8,opus';
  
  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 5000000,
    audioBitsPerSecond: 128000
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    exportToMP4();
  };

  mediaRecorder.start(1000);
  showRecordingIndicator();
  drawFrame();
}

async function stopRecording() {
  hideRecordingIndicator();
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (webcamOverlay) {
    webcamOverlay.remove();
    webcamOverlay = null;
  }

  chrome.runtime.sendMessage({ action: 'recordingStopped' });
}

function cleanup() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  if (combinedStream) {
    combinedStream.getTracks().forEach(track => track.stop());
    combinedStream = null;
  }
  if (webcamOverlay) {
    webcamOverlay.remove();
    webcamOverlay = null;
  }
  hideRecordingIndicator();
  selectedArea = null;
}

function exportToMP4() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  openEditor(blob);
  cleanup();
  recordedChunks = [];
}

function openEditor(blob) {
  const editorUrl = chrome.runtime.getURL('editor.html');
  const editorWindow = window.open(editorUrl, 'VideoEditor', 'width=950,height=700');
  
  window.addEventListener('message', function handler(e) {
    if (e.data.type === 'editorReady') {
      editorWindow.postMessage({ type: 'videoBlob', blob }, '*');
      window.removeEventListener('message', handler);
    }
  });
}
