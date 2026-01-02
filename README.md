# ScreenCastMe - Chrome Extension

En Chrome-tillägg för att spela in skärmen med webbkamera-overlay och exportera till video.

## Funktioner

- **Inspelningslägen:**
  - Aktuell flik
  - Hela skärmen
  - Markerat område

- **Webbkamera-overlay:**
  - Cirkulär webbkamera-bild
  - Dragbar till valfri position
  - Förvalda positioner (hörn)

- **Ljud:** Spela in systemljud från fliken/skärmen

- **Inbyggd editor:**
  - Trimma video (klipp bort start/slut)
  - Förhandsvisning innan export
  - Visuell tidslinje med drag-handles

## Kompatibilitet

WebM-formatet fungerar direkt med:
- ✅ YouTube
- ✅ LinkedIn (organiska inlägg)
- ✅ VLC, QuickTime, moderna webbläsare

## Installation

1. Öppna Chrome och gå till `chrome://extensions/`
2. Aktivera **Developer mode** (växlare uppe till höger)
3. Klicka på **Load unpacked**
4. Välj mappen `chrome_record`
5. Tillägget är nu installerat!

## Användning

1. Klicka på tilläggets ikon i Chrome-verktygsfältet
2. Välj inspelningsläge (flik/skärm/område)
3. Aktivera/avaktivera webbkamera och ljud
4. Välj position för webbkamera-overlay
5. Klicka **Start Recording**
6. Chrome frågar om tillåtelse att dela skärm/flik
7. Inspelningen startar - webbkameran visas som en dragbar cirkel
8. Klicka **Stop Recording** för att avsluta
9. **Editorn öppnas** - trimma videon om du vill
10. Klicka **Export Video** för att ladda ned

## Teknisk information

- Manifest V3
- Använder `desktopCapture` API för skärminspelning
- Canvas-baserad video-compositing för webbkamera-overlay
- MediaRecorder API för inspelning

## Filer

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

## Licens

Detta projekt är licensierat under MIT License - se [LICENSE](LICENSE) filen för detaljer.
