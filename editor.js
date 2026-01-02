let videoBlob = null;
let videoDuration = 0;
let trimStart = 0;
let trimEnd = 0;
let isDragging = null;

const video = document.getElementById('videoPlayer');
const timeline = document.getElementById('timeline');
const trimStartHandle = document.getElementById('trimStart');
const trimEndHandle = document.getElementById('trimEnd');
const trimOverlayStart = document.getElementById('trimOverlayStart');
const trimOverlayEnd = document.getElementById('trimOverlayEnd');
const playhead = document.getElementById('playhead');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const trimStartInput = document.getElementById('trimStartInput');
const trimEndInput = document.getElementById('trimEndInput');
const trimDurationInput = document.getElementById('trimDuration');
const previewBtn = document.getElementById('previewBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const closeBtn = document.getElementById('closeBtn');
const statusEl = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

function formatTime(seconds) {
  if (!isFinite(seconds) || isNaN(seconds)) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function getDuration(video) {
  // If duration is valid, return it
  if (video.duration && isFinite(video.duration) && !isNaN(video.duration)) {
    return video.duration;
  }
  
  // For WebM with unknown duration, seek through to find it
  return new Promise((resolve) => {
    const originalTime = video.currentTime;
    
    // Binary search for duration
    let low = 0;
    let high = 3600; // Max 1 hour
    let lastValid = 0;
    
    const seekAndCheck = () => {
      const mid = (low + high) / 2;
      
      if (high - low < 0.5) {
        video.currentTime = originalTime;
        resolve(lastValid || 30);
        return;
      }
      
      video.currentTime = mid;
    };
    
    video.onseeked = () => {
      if (video.currentTime > lastValid) {
        lastValid = video.currentTime;
        low = video.currentTime;
      } else {
        high = (low + high) / 2;
      }
      
      if (high - low < 0.5) {
        video.currentTime = 0;
        video.onseeked = null;
        resolve(lastValid || 30);
      } else {
        seekAndCheck();
      }
    };
    
    seekAndCheck();
    
    // Timeout fallback
    setTimeout(() => {
      video.onseeked = null;
      video.currentTime = 0;
      resolve(lastValid || 30);
    }, 5000);
  });
}

function updateTrimDisplay() {
  trimStartInput.value = formatTime(trimStart);
  trimEndInput.value = formatTime(trimEnd);
  trimDurationInput.value = formatTime(trimEnd - trimStart);
  
  const startPercent = (trimStart / videoDuration) * 100;
  const endPercent = ((videoDuration - trimEnd) / videoDuration) * 100;
  
  trimStartHandle.style.left = `${startPercent}%`;
  trimEndHandle.style.right = `${endPercent}%`;
  trimOverlayStart.style.width = `${startPercent}%`;
  trimOverlayEnd.style.width = `${endPercent}%`;
}

function updatePlayhead() {
  const percent = (video.currentTime / videoDuration) * 100;
  playhead.style.left = `${percent}%`;
  currentTimeEl.textContent = formatTime(video.currentTime);
}

function initEditor(blob) {
  videoBlob = blob;
  const url = URL.createObjectURL(blob);
  video.src = url;
  
  // WebM files may report Infinity duration - we need to find real duration
  video.addEventListener('loadedmetadata', () => {
    getDuration(video).then(duration => {
      videoDuration = duration;
      trimEnd = videoDuration;
      durationEl.textContent = formatTime(videoDuration);
      updateTrimDisplay();
      setStatus('Drag the red handles to trim your video', '');
    });
  });
  
  video.addEventListener('timeupdate', updatePlayhead);
  
  video.addEventListener('play', () => {
    if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
    }
  });
  
  video.addEventListener('timeupdate', () => {
    if (video.currentTime >= trimEnd) {
      video.pause();
      video.currentTime = trimStart;
    }
  });
}

function handleTimelineClick(e) {
  if (isDragging) return;
  const rect = timeline.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const time = percent * videoDuration;
  video.currentTime = Math.max(trimStart, Math.min(trimEnd, time));
}

function startDrag(handle) {
  isDragging = handle;
  document.body.style.cursor = 'ew-resize';
}

function handleDrag(e) {
  if (!isDragging) return;
  
  const rect = timeline.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const time = percent * videoDuration;
  
  if (isDragging === 'start') {
    trimStart = Math.max(0, Math.min(time, trimEnd - 1));
  } else if (isDragging === 'end') {
    trimEnd = Math.max(trimStart + 1, Math.min(time, videoDuration));
  }
  
  updateTrimDisplay();
}

function stopDrag() {
  isDragging = null;
  document.body.style.cursor = '';
}

trimStartHandle.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  startDrag('start');
});

trimEndHandle.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  startDrag('end');
});

document.addEventListener('mousemove', handleDrag);
document.addEventListener('mouseup', stopDrag);
timeline.addEventListener('click', handleTimelineClick);

previewBtn.addEventListener('click', () => {
  video.currentTime = trimStart;
  video.play();
  setStatus('Playing trimmed preview...', '');
});

resetBtn.addEventListener('click', () => {
  trimStart = 0;
  trimEnd = videoDuration;
  updateTrimDisplay();
  video.currentTime = 0;
  setStatus('Trim reset', 'success');
});

exportBtn.addEventListener('click', async () => {
  if (trimStart === 0 && trimEnd === videoDuration) {
    downloadBlob(videoBlob, 'screen-recording');
    return;
  }
  
  setStatus('Trimming video...', '');
  progressContainer.classList.remove('hidden');
  exportBtn.disabled = true;
  
  try {
    const trimmedBlob = await trimVideo(videoBlob, trimStart, trimEnd);
    downloadBlob(trimmedBlob, 'screen-recording-trimmed');
    setStatus('Video exported!', 'success');
  } catch (err) {
    setStatus('Export failed: ' + err.message, 'error');
  } finally {
    progressContainer.classList.add('hidden');
    exportBtn.disabled = false;
  }
});

closeBtn.addEventListener('click', () => {
  window.close();
});

async function trimVideo(blob, start, end) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    
    video.onloadedmetadata = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });
      
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };
      
      video.currentTime = start;
      await new Promise(r => video.onseeked = r);
      
      recorder.start();
      video.play();
      
      const duration = end - start;
      let elapsed = 0;
      
      const drawFrame = () => {
        if (video.currentTime >= end || video.paused) {
          recorder.stop();
          video.pause();
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        elapsed = video.currentTime - start;
        const progress = Math.min(100, (elapsed / duration) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        
        requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
    };
    
    video.onerror = () => reject(new Error('Failed to load video'));
  });
}

function downloadBlob(blob, filename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${timestamp}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
}

window.addEventListener('message', (e) => {
  if (e.data.type === 'videoBlob') {
    initEditor(e.data.blob);
  }
});

if (window.opener) {
  window.opener.postMessage({ type: 'editorReady' }, '*');
}
