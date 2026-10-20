export type MessageType = 'message' | 'error' | 'system' | 'voice-message';

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  timestamp: number;
}

export interface ToolCallLog {
  timestamp: string;
  tool: string;
  params: Record<string, any>;
  result: Record<string, any>;
}

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  status: number;
}

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ModelStatus {
  isLoading: boolean;
  isLoaded: boolean;
  modelName: string;
  message: string;
}

export interface RecordingState {
  isRecording: boolean;
  recordingId: string | null;
  audioFilePath: string | null;
  startTime: number | null;
  levels: number[];
  tentativeText: string;
  committedText: string;
}
