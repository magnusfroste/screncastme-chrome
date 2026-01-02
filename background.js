let isRecording = false;
let recordingStartTime = null;
let activeTabId = null;

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content.css']
      });
      return true;
    } catch (err) {
      console.error('Cannot inject content script:', err);
      return false;
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
      sendResponse({ isRecording });
      break;
      
    case 'getStartTime':
      sendResponse({ startTime: recordingStartTime });
      break;
      
    case 'startRecording':
      startRecording(message.options, sendResponse);
      return true;
      
    case 'stopRecording':
      stopRecording(sendResponse);
      return true;
      
    case 'recordingStarted':
      isRecording = true;
      recordingStartTime = Date.now();
      sendResponse({ success: true });
      break;
      
    case 'recordingStopped':
      isRecording = false;
      recordingStartTime = null;
      sendResponse({ success: true });
      break;
  }
  return true;
});

async function startRecording(options, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab.id;
    
    // Check if we can use this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      sendResponse({ success: false, error: 'Cannot record Chrome system pages. Please navigate to a regular webpage.' });
      return;
    }
    
    // Ensure content script is injected
    const injected = await ensureContentScript(tab.id);
    if (!injected) {
      sendResponse({ success: false, error: 'Could not initialize recording on this page. Try refreshing the page.' });
      return;
    }
    
    if (options.captureMode === 'tab') {
      chrome.desktopCapture.chooseDesktopMedia(
        ['tab'],
        tab,
        (streamId) => {
          if (streamId) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'initRecording',
              streamId,
              options
            }, response => {
              sendResponse(response || { success: false, error: 'No response from content script' });
            });
          } else {
            sendResponse({ success: false, error: 'User cancelled or no stream available' });
          }
        }
      );
    } else if (options.captureMode === 'screen') {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window'],
        tab,
        (streamId) => {
          if (streamId) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'initRecording',
              streamId,
              options
            }, response => {
              sendResponse(response || { success: false, error: 'No response from content script' });
            });
          } else {
            sendResponse({ success: false, error: 'User cancelled or no stream available' });
          }
        }
      );
    } else if (options.captureMode === 'area') {
      // First show area selector, then trigger screen capture
      chrome.tabs.sendMessage(tab.id, {
        action: 'selectArea',
        options
      }, response => {
        // Send response immediately - area selector will trigger another startRecording
        sendResponse(response || { success: true });
      });
      return;
    }
    
    // Handle area recording (after area was selected)
    if (options.selectedArea) {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen'],
        tab,
        (streamId) => {
          if (streamId) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'initRecording',
              streamId,
              options
            }, response => {
              sendResponse(response || { success: false, error: 'No response from content script' });
            });
          } else {
            sendResponse({ success: false, error: 'User cancelled or no stream available' });
          }
        }
      );
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function stopRecording(sendResponse) {
  try {
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'stopRecording' }, response => {
        isRecording = false;
        recordingStartTime = null;
        sendResponse(response || { success: true });
      });
    } else {
      sendResponse({ success: false, error: 'No active recording tab' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
