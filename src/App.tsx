import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, MessageType } from './types';
import { tools, setStopRequested, setConfirmHandler } from './core/tools';
import { processPrompt } from './core/agent';
import {
  startRecording,
  stopRecording,
  transcribeAudio,
  generateAudioLevels,
  checkModelStatus,
} from './core/audio';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      text: 'Chitti [React] started. Type a command or click the mic button to use voice input.',
      type: 'system',
      timestamp: Date.now(),
    },
    {
      id: 'init-2',
      text: 'Press Ctrl+SPACE to activate voice input.',
      type: 'system',
      timestamp: Date.now() + 1,
    },
    {
      id: 'init-3',
      text: 'Enhanced voice features: audio visualization, model status, tentative/committed transcription',
      type: 'system',
      timestamp: Date.now() + 2,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 45, 60, 80, 50, 35, 20, 10]);
  const [modelStatusText, setModelStatusText] = useState<string>('');
  const [tentativeText, setTentativeText] = useState<string>('');
  const [committedText, setCommittedText] = useState<string>('');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);

  // Confirmation modal state for dangerous operations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    message: '',
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const audioFilePathRef = useRef(audioFilePath);
  audioFilePathRef.current = audioFilePath;

  const recordingIdRef = useRef(recordingId);
  recordingIdRef.current = recordingId;

  // Auto-scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Hook into confirmation handler
  useEffect(() => {
    setConfirmHandler((message: string) => {
      return new Promise<boolean>((resolve) => {
        setConfirmModal({
          isOpen: true,
          message,
          resolve,
        });
      });
    });
  }, []);

  const addMessage = useCallback((text: string, type: MessageType = 'message') => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        text,
        type,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Periodic updates for audio levels and model status when recording
  useEffect(() => {
    let levelsInterval: any = null;
    let modelInterval: any = null;

    if (isRecording) {
      levelsInterval = setInterval(() => {
        setAudioLevels(generateAudioLevels());
      }, 100);

      const checkStatus = async () => {
        const result = await checkModelStatus();
        if (result.success) {
          if (result.isLoading) {
            setModelStatusText('🔄 Loading model...');
          } else if (result.isLoaded) {
            setModelStatusText('✅ Model ready');
          } else {
            setModelStatusText('❌ Model not loaded');
          }
        }
      };

      checkStatus();
      modelInterval = setInterval(checkStatus, 2000);
    } else {
      if (levelsInterval) clearInterval(levelsInterval);
      if (modelInterval) clearInterval(modelInterval);
    }

    return () => {
      if (levelsInterval) clearInterval(levelsInterval);
      if (modelInterval) clearInterval(modelInterval);
    };
  }, [isRecording]);

  const handleStopRecordingFlow = useCallback(async () => {
    try {
      const activePath = audioFilePathRef.current;
      const activeId = recordingIdRef.current;

      const stopResult = await stopRecording({
        audioFilePath: activePath || undefined,
        recordingId: activeId || undefined,
      });

      setIsRecording(false);
      setRecordingId(null);
      setAudioFilePath(null);
      addMessage('Recording stopped. Processing...', 'voice-message');

      setTentativeText(stopResult.tentativeText || 'Processing audio...');
      setCommittedText('');

      // Simulated transcription finalization delay matching main.js
      setTimeout(async () => {
        const transcribeResult = await transcribeAudio({
          audioFilePath: stopResult.audioFilePath,
        });

        if (transcribeResult.success && transcribeResult.transcription) {
          setTentativeText('');
          setCommittedText(transcribeResult.transcription);
          addMessage(`You said: "${transcribeResult.transcription}"`, 'voice-message');

          // If the transcribed text is a command or query, optionally populate into input
          setInputVal(transcribeResult.transcription);
        } else {
          setTentativeText('');
          setCommittedText('');
          addMessage(`Transcription error: ${transcribeResult.error || 'Unknown error'}`, 'error');
        }
      }, 800);
    } catch (error: any) {
      setIsRecording(false);
      addMessage(`Error stopping recording: ${error.message}`, 'error');
      setTentativeText('');
      setCommittedText('');
    }
  }, [addMessage]);

  const handleMicClick = useCallback(async () => {
    if (!isRecordingRef.current) {
      try {
        const result = await startRecording();
        if (result.success) {
          setIsRecording(true);
          setAudioFilePath(result.audioFilePath || null);
          setRecordingId(result.recordingId || null);
          if (result.initialLevels) {
            setAudioLevels(result.initialLevels);
          }
          addMessage('Voice recording started...', 'voice-message');
        } else {
          addMessage(`Error starting recording: ${result.error}`, 'error');
        }
      } catch (error: any) {
        addMessage(`Error: ${error.message}`, 'error');
      }
    } else {
      await handleStopRecordingFlow();
    }
  }, [addMessage, handleStopRecordingFlow]);

  // Global Ctrl+SPACE hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        handleMicClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMicClick]);

  // Stop button handler
  const handleStop = useCallback(() => {
    setStopRequested(true);
    addMessage('Stop requested...', 'system');
    if (isRecordingRef.current) {
      handleStopRecordingFlow();
    }
  }, [addMessage, handleStopRecordingFlow]);

  // Command submission handler
  const handleSend = async () => {
    const text = inputVal.trim();
    if (!text) return;

    addMessage(`> ${text}`, 'message');
    setInputVal('');

    try {
      if (text.startsWith('run ')) {
        const cmd = text.slice(4).trim();
        const result = await tools.runShell({ command: cmd });
        if (result.success) {
          addMessage(`Output: ${result.stdout}`, 'message');
        } else {
          addMessage(`Error: ${result.stderr}`, 'error');
        }
      } else if (text.startsWith('read ')) {
        const file = text.slice(5).trim();
        const result = await tools.readFile({ filePath: file });
        if (result.success) {
          addMessage(`Contents of ${file}:\n${result.content}`, 'message');
        } else {
          addMessage(`Error: ${result.error}`, 'error');
        }
      } else if (text.startsWith('write ')) {
        const parts = text.slice(6).trim().split(' ');
        if (parts.length < 2) {
          addMessage('Usage: write <file> <content>', 'error');
          return;
        }
        const file = parts[0];
        const content = parts.slice(1).join(' ');
        const result = await tools.writeFile({ filePath: file, content });
        if (result.success) {
          addMessage(`Written to ${file}`, 'message');
        } else {
          addMessage(`Error: ${result.error}`, 'error');
        }
      } else if (text.startsWith('rea ')) {
        const target = text.slice(4).trim();
        const result = await tools.rea({ target });
        if (result.success) {
          addMessage(`REA analysis complete. Output length: ${result.stdout.length} chars`, 'message');
        } else {
          addMessage(`Error: ${result.stderr}`, 'error');
        }
      } else {
        // Natural language prompt via agent loop
        const result = await processPrompt(text);
        if (result.startsWith('Error: ')) {
          addMessage(result, 'error');
        } else {
          addMessage(result, 'message');
        }
      }
    } catch (err: any) {
      addMessage(`Unexpected error: ${err.message}`, 'error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <div className="badge">React v1.0.0</div>

      <div id="messages">
        {messages.map((m) => (
          <div key={m.id} className={m.type}>
            {m.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="voice-controls">
        <input
          id="input"
          type="text"
          placeholder="Type command (run ..., read ..., write ..., rea ...) or prompt..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyPress}
          autoFocus
        />
        <button id="send" onClick={handleSend}>
          Send
        </button>
        <button
          id="mic-button"
          className={isRecording ? 'recording' : ''}
          onClick={handleMicClick}
        >
          {isRecording ? '⏹️ Stop' : '🎤 Mic'}
        </button>
        <button id="stop" onClick={handleStop}>
          Stop
        </button>
      </div>

      <div
        id="audio-levels-container"
        className="audio-levels"
        style={{ display: isRecording ? 'flex' : 'none' }}
      >
        <div id="level-bars" style={{ display: 'flex', width: '100%', height: '100%', gap: '2px' }}>
          {audioLevels.map((lvl, idx) => (
            <div
              key={idx}
              className="level-bar"
              style={{ height: `${Math.min(100, Math.max(5, lvl))}%` }}
            />
          ))}
        </div>
      </div>

      {modelStatusText && (
        <div id="model-status" className="model-status">
          {modelStatusText}
        </div>
      )}

      {(tentativeText || committedText) && (
        <div id="transcription-output" className="transcription-text">
          {tentativeText && (
            <div id="tentative-text" className="tentative-text">
              {tentativeText}
            </div>
          )}
          {committedText && (
            <div id="committed-text" className="committed-text">
              {committedText}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Safety Check */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">⚠️ Confirm Dangerous Operation</div>
            <div className="modal-message">{confirmModal.message}</div>
            <div className="modal-actions">
              <button
                className="modal-btn-cancel"
                onClick={() => {
                  confirmModal.resolve?.(false);
                  setConfirmModal({ isOpen: false, message: '' });
                }}
              >
                Cancel
              </button>
              <button
                className="modal-btn-confirm"
                onClick={() => {
                  confirmModal.resolve?.(true);
                  setConfirmModal({ isOpen: false, message: '' });
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
