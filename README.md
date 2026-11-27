[README.md](https://github.com/user-attachments/files/35511439/README.md)
# ChatFlow Android

A lightweight Android WebView app for importing and reading timestamped `.txt` chat exports locally.

## Included
- Aurora, Forest, AMOLED and Pearl themes
- Local `.txt` import (no upload/server)
- Two-person sender normalization (e.g. `Zobayer(wp1)` and `Zobayer(fb1)` become `Zobayer`)
- Messenger-style chat bubbles and date separators
- Search, load-earlier paging, message distribution and activity charts
- Android vibration feedback where supported

## Build an APK using GitHub Actions (no Android Studio required)
1. Create a new GitHub repository.
2. Upload all files and folders from this project to the repository root.
3. Open **Actions** → **Build ChatFlow APK** → **Run workflow**.
4. Wait for the workflow to finish.
5. Open the successful run and download **ChatFlow-debug-apk** under Artifacts.
6. Extract the ZIP and install `app-debug.apk` on your Android phone. You may need to allow installation from your file manager/browser.

## Build locally
Requires JDK 17, Android SDK Platform 35 and Gradle 8.9:
`gradle assembleDebug`

## Notes
- The imported text is parsed in the WebView on-device and the latest archive is saved in app-local IndexedDB for the next launch. The app does not transmit chat content.
- The first version supports WhatsApp-style lines such as `9/20/25, 10:34 PM - Name: Message` and multiline message continuations.
- For very large exports, parsing is done in one pass. The reader only renders a page at a time to reduce UI load.
- The project intentionally does not bundle your personal chat export.
- Charts are drawn locally on canvas; no external chart service is used.
