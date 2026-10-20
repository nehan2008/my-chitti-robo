import { ModelStatus } from '../types';

export interface ActiveRecording {
  recordingId: string;
  audioFilePath: string;
  startTime: number;
  stopTime?: number;
  levels: number[];
  isProcessing: boolean;
}

const activeRecordings = new Map<string, ActiveRecording>();

let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let speechRecognizer: any = null;
let liveTranscribedText = '';

// Realistic transcription simulations from original main.js
const simulations = [
  'Hello, how are you today?',
  'The quick brown fox jumps over the lazy dog.',
  'Speech to text conversion is working properly.',
  'I love using voice commands with Chitti.',
  'This is a test of the voice recognition system.',
  'Can you hear me clearly now?',
  'The weather is nice outside today.',
  'Please send an email to John about the project.',
  'What time is our meeting scheduled for?',
  'Thank you for using Chitti voice features.',
];

export function generateAudioLevels(): number[] {
  // If real live microphone analyser is active, read 9 frequency bands
  if (analyserNode) {
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(dataArray);
    const bands: number[] = [];
    const step = Math.floor(dataArray.length / 9);
    for (let i = 0; i < 9; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] || 0;
      }
      const avg = sum / (step || 1);
      bands.push(Math.min(100, Math.round((avg / 255) * 100)));
    }
    return bands;
  }

  // Realistic fallback simulated levels (9 frequency bands)
  const levels: number[] = [];
  for (let i = 0; i < 9; i++) {
    const base = Math.sin(Date.now() / 200 + i * 0.5) * 30 + 40;
    const randomJitter = Math.floor(Math.random() * 30);
    levels.push(Math.max(10, Math.min(100, Math.floor(base + randomJitter))));
  }
  return levels;
}

export async function startRecording(): Promise<{
  success: boolean;
  audioFilePath?: string;
  recordingId?: string;
  message?: string;
  initialLevels?: number[];
  error?: string;
}> {
  try {
    const timestamp = Date.now();
    const audioFileName = `recording_${timestamp}.wav`;
    const audioFilePath = `outputs/${audioFileName}`;
    const recordingId = Math.random().toString(36).substring(2, 11);

    // Try setting up Web Audio API microphone analyser if user permissions allow
    try {
      if (typeof window !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(mediaStream);
          analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 64;
          source.connect(analyserNode);
        }

        // Web Speech Recognition if available
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          speechRecognizer = new SpeechRec();
          speechRecognizer.continuous = false;
          speechRecognizer.interimResults = true;
          liveTranscribedText = '';
          speechRecognizer.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((r: any) => r[0].transcript)
              .join('');
            liveTranscribedText = transcript;
          };
          speechRecognizer.onerror = () => {
            // Ignore mic speech recognition errors; simulation will provide fallback
          };
          speechRecognizer.start();
        }
      }
    } catch {
      // Graceful fallback to simulated audio levels
      mediaStream = null;
      analyserNode = null;
    }

    const initialLevels = generateAudioLevels();

    activeRecordings.set(recordingId, {
      recordingId,
      audioFilePath,
      startTime: Date.now(),
      levels: initialLevels,
      isProcessing: false,
    });

    return {
      success: true,
      audioFilePath,
      recordingId,
      message: 'Recording started',
      initialLevels,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to start recording',
    };
  }
}

export async function stopRecording(args: {
  audioFilePath?: string;
  recordingId?: string;
}): Promise<{
  success: boolean;
  audioFilePath?: string;
  transcription?: string;
  tentativeText?: string;
  message?: string;
  processingTime?: number;
  error?: string;
}> {
  try {
    const { recordingId } = args;
    let recording: ActiveRecording | undefined;

    if (recordingId) {
      recording = activeRecordings.get(recordingId);
    }

    if (!recording && activeRecordings.size > 0) {
      recording = Array.from(activeRecordings.values())[0];
    }

    // Stop live mic stream and recognition
    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStream = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch {
        // ignore
      }
      audioContext = null;
      analyserNode = null;
    }

    if (!recording) {
      return {
        success: false,
        error: 'No active recording found or already processed',
      };
    }

    recording.isProcessing = true;
    recording.stopTime = Date.now();

    const timestamp = parseInt(recording.audioFilePath.split('_').pop()?.split('.')[0] || '0', 10);
    const simIndex = isNaN(timestamp) ? 0 : timestamp % simulations.length;
    const finalTranscription = liveTranscribedText.trim() || simulations[simIndex] || 'Voice transcription successful.';

    return {
      success: true,
      audioFilePath: recording.audioFilePath,
      transcription: finalTranscription,
      tentativeText: 'Processing audio...',
      message: 'Recording stopped and transcribed',
      processingTime: Date.now() - recording.startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to stop recording',
    };
  }
}

export async function transcribeAudio(args: {
  audioFilePath?: string;
}): Promise<{
  success: boolean;
  transcription?: string;
  tentativeText?: string;
  message?: string;
  isTentative?: boolean;
  levels?: number[];
  error?: string;
}> {
  try {
    const { audioFilePath } = args;
    const hash = audioFilePath?.split('_').pop()?.split('.')[0] || '';
    const num = parseInt(hash, 10);
    const index = isNaN(num) ? 0 : num % simulations.length;
    const transcription = liveTranscribedText.trim() || simulations[index] || 'Voice transcription successful.';

    return {
      success: true,
      transcription,
      tentativeText: 'Listening...',
      message: 'Transcription completed',
      isTentative: false,
      levels: generateAudioLevels(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to transcribe audio',
    };
  }
}

export async function checkModelStatus(): Promise<{
  success: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  modelName: string;
  message: string;
  error?: string;
}> {
  try {
    // Model status simulation matching original main.js logic:
    // 30% chance of appearing to load, 90% chance of loaded if not loading
    const isLoading = Math.random() > 0.7;
    const isLoaded = !isLoading && Math.random() > 0.1;
    return {
      success: true,
      isLoading,
      isLoaded,
      modelName: 'ggml-base.en.bin',
      message: isLoading ? 'Model loading...' : isLoaded ? 'Model ready' : 'Model not loaded',
    };
  } catch (error: any) {
    return {
      success: false,
      isLoading: false,
      isLoaded: false,
      modelName: 'ggml-base.en.bin',
      message: error.message || 'Error checking model status',
      error: error.message,
    };
  }
}
