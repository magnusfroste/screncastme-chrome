document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const enableWebcam = document.getElementById('enableWebcam');
  const enableAudio = document.getElementById('enableAudio');
  const webcamSettings = document.getElementById('webcamSettings');
  const statusEl = document.getElementById('status');
  const timerEl = document.getElementById('timer');
  const posButtons = document.querySelectorAll('.pos-btn');
  const captureModeInputs = document.querySelectorAll('input[name="captureMode"]');

  let webcamPosition = 'bottom-right';
  let timerInterval = null;
  let startTime = null;

  posButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      posButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      webcamPosition = btn.dataset.pos;
    });
  });

  enableWebcam.addEventListener('change', () => {
    webcamSettings.classList.toggle('disabled', !enableWebcam.checked);
  });

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }

  function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
  }

  async function checkRecordingState() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getState' }, response => {
        resolve(response?.isRecording || false);
      });
    });
  }

  async function updateUI() {
    const isRecording = await checkRecordingState();
    startBtn.disabled = isRecording;
    stopBtn.disabled = !isRecording;
    
    if (isRecording) {
      timerEl.classList.remove('hidden');
      chrome.runtime.sendMessage({ action: 'getStartTime' }, response => {
        if (response?.startTime) {
          startTime = response.startTime;
          timerInterval = setInterval(updateTimer, 1000);
          updateTimer();
        }
      });
    }
  }

  startBtn.addEventListener('click', async () => {
    const captureMode = document.querySelector('input[name="captureMode"]:checked').value;
    const withWebcam = enableWebcam.checked;
    const withAudio = enableAudio.checked;

    setStatus('Starting recording...');
    startBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'startRecording',
      options: {
        captureMode,
        withWebcam,
        withAudio,
        webcamPosition
      }
    }, response => {
      if (response?.success) {
        stopBtn.disabled = false;
        setStatus('Recording...', 'success');
        timerEl.classList.remove('hidden');
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
      } else {
        startBtn.disabled = false;
        setStatus(response?.error || 'Failed to start recording', 'error');
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    setStatus('Stopping recording...');
    stopBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'stopRecording' }, response => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      timerEl.classList.add('hidden');
      startBtn.disabled = false;
      
      if (response?.success) {
        setStatus('Recording saved!', 'success');
      } else {
        setStatus(response?.error || 'Failed to save recording', 'error');
      }
    });
  });

  updateUI();
});
