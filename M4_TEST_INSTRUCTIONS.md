# M4 Voice Features Testing Instructions

## Overview
This document provides step-by-step instructions for testing the M4 voice features implemented in Chitti JS:
- Mic button for voice input
- Offline transcription (simulated whisper.cpp integration)
- Hotkey (Ctrl+SPACE) for voice activation

## Prerequisites
1. Chitti JS application installed
2. Node.js and npm installed
3. Electron installed (should be in devDependencies)

## Installation
If not already done, install dependencies:
```bash
npm install
```

## Starting the Application
```bash
npm start
```
or
```bash
electron .
```

## Testing Instructions

### 1. Test Mic Button Functionality
1. Start the application using `npm start`
2. Click the "🎤 Mic" button
   - Button should change to "⏹️ Stop" and turn red
   - A message should appear: "Voice recording started..."
3. Click the "⏹️ Stop" button
   - Button should change back to "🎤 Mic" and turn blue
   - Messages should appear:
     - "Recording stopped. Transcribing..."
     - "You said: \"This is a simulated transcription from whisper.cpp.\""
4. Verify the transcription message appears correctly

### 2. Test Hotkey Functionality (Ctrl+SPACE)
1. Start the application using `npm start`
2. Make sure the application window is focused
3. Press Ctrl+SPACE
   - Should behave exactly like clicking the mic button
   - Button should change to "⏹️ Stop" and turn red
   - Message should appear: "Voice recording started..."
4. Press Ctrl+SPACE again
   - Should stop recording and start transcription
   - Button should change back to "🎤 Mic" and turn blue
   - Messages should appear:
     - "Recording stopped. Transcribing..."
     - "You said: \"This is a simulated transcription from whisper.cpp.\""

### 3. Test Integration with Stop Button
1. Start the application using `npm start`
2. Click the "🎤 Mic" button to start recording
3. Click the red "Stop" button (not the mic button)
   - Should stop the application's processing
   - Should also stop any active recording
   - Mic button should reset to "🎤 Mic"
   - Message should appear: "Stop requested..."

### 4. Test File Storage Location
1. Start the application
2. Use the mic button to record and stop a voice note
3. After transcription completes, check the outputs folder:
   ```bash
   dir ../../outputs\
   ```
   or
   ```bash
   ls -la ../../outputs/
   ```
4. You should see WAV files named like `recording_<timestamp>.wav`
5. These files confirm audio is being stored in the allowed outputs folder

### 5. Test Security Folder Restrictions
1. Start the application
2. Try to access a restricted folder using voice or text input:
   - Say or type: "read C:\\Windows\\System32\\config\\SAM"
3. Should get an error: "Access denied: Path '...' is not within allowed folders"
4. Try accessing an allowed folder:
   - Say or type: "read ..\\package.json"
5. Should work (with confirmation if TEST_AUTO_APPROVE not set)

## Expected Behavior
- Mic button toggles between recording and stopped states
- Ctrl+SPACE hotkey provides same functionality as mic button
- Recording state is visually indicated by button color and text change
- Transcription returns simulated text (in real implementation, this would be actual whisper.cpp output)
- Audio files are stored in the outputs folder (already allowed by M3 safety features)
- Folder restrictions from M3 still apply and protect against unauthorized access
- Stop button halts all operations including voice recording

## Notes on Current Implementation
- The voice recording is currently simulated (creates empty WAV files)
- Transcription is simulated (returns fixed text)
- In a production implementation, these would be replaced with:
  - Actual audio recording using native APIs or libraries like `node-record-lpcm16` or `Recorder.js`
  - Actual whisper.cpp integration for transcription
- The folder structure uses the outputs folder which is already permitted by M3 safety features
- All M3 safety features (confirmation dialogs, stop mechanism, logging) remain active and functional

## Troubleshooting
- If mic button doesn't work: Check that the application window is focused for hotkeys
- If transcription doesn't show: Check the developer console for errors
- If file access errors occur: Verify you're using allowed folders (Chitti JS dir or outputs dir)
- If hotkeys don't work: Make sure no other application is capturing Ctrl+SPACE

## Next Steps for Real Implementation
To implement real voice recording and transcription:
1. Replace simulated recording with actual audio capture
2. Integrate with whisper.cpp binary for transcription
3. Properly handle WAV file formatting and data writing
4. Add error handling for missing dependencies
5. Consider adding voice visualization during recording