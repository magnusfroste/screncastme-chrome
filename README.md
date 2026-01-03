# ScreenCastMe - Chrome Extension

A Chrome extension for recording your screen with webcam overlay and exporting to video.

## Features

- **Recording Modes:**
  - Current tab
  - Entire screen
  - Selected area

- **Webcam Overlay:**
  - Circular webcam display
  - Draggable to any position
  - Preset positions (corners)

- **Audio:** Record system audio from tab/screen

- **Built-in Editor:**
  - Trim video (cut start/end)
  - Preview before export
  - Visual timeline with drag handles

## Compatibility

WebM format works directly with:
- ✅ YouTube
- ✅ LinkedIn (organic posts)
- ✅ VLC, QuickTime, modern browsers

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `chrome_record` folder
5. The extension is now installed!

## Usage

1. Click the extension icon in the Chrome toolbar
2. Select recording mode (tab/screen/area)
3. Enable/disable webcam and audio
4. Select position for webcam overlay
5. Click **Start Recording**
6. Chrome asks for permission to share screen/tab
7. Recording starts - webcam appears as a draggable circle
8. Click **Stop Recording** to finish
9. **Editor opens** - trim the video if you want
10. Click **Export Video** to download

## Technical Information

- Manifest V3
- Uses `desktopCapture` API for screen recording
- Canvas-based video compositing for webcam overlay
- MediaRecorder API for recording

## Files

```
chrome_record/
├── manifest.json      # Extension manifest
├── editor.html/css/js # Video editor
├── popup.html         # Popup UI
├── popup.css          # Popup styling
├── popup.js           # Popup logic
├── background.js      # Service worker
├── content.js         # Content script (recording logic)
├── content.css        # Webcam overlay styling
└── icons/             # Extension icons
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
