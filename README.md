# Chitti [React]

A React build of Chitti AI Assistant ported to Vite and modern TypeScript.

## Features

- **Window & Interface**: Clean desktop assistant interface with original accent colors (green `#4CAF50`, blue `#2196F3`, red `#f44336`), scrollable message terminal, and top-right build badge.
- **Command Execution**:
  - `run <cmd>`: Shell command execution with dangerous operation safety detection and prompt confirmation.
  - `read <file>`: Virtual file reader with folder boundary validation.
  - `write <file> <content>`: Virtual file writer with access control.
  - `rea <target>`: Reverse engineering code analysis simulation.
  - Natural Language queries: Processed by Chitti agent loop with tool execution.
- **M4 Voice Features**:
  - Voice recording with real microphone input (Web Audio API & Web Speech API) and realistic fallback simulation.
  - Real-time 9-band audio equalizer visualization responding to voice amplitude.
  - Whisper model status indicator (`🔄 Loading model...`, `✅ Model ready`, `❌ Model not loaded`).
  - Two-stage transcription output with tentative live status and committed final text.
  - Hotkey support: Press `Ctrl+SPACE` to toggle voice recording.
- **Safety Features**:
  - Dangerous command interception for commands like `rm`, `del`, `format`, `sudo`, `kill -9`, etc., requiring confirmation.
  - Allowed-folder boundary enforcement (`Safety.isPathAllowed`).
  - Tool call logging stored in `logs/tool_calls.log`.
  - Immediate stop button mechanism.

## Setup & Development

1. Install dependencies: `npm install`
2. Start development server: `npm run dev` (starts Vite on `http://0.0.0.0:3000`)
3. Build for production: `npm run build`