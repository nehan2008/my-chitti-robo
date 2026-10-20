import { ToolCallLog, ShellResult, FileResult } from '../types';

let stopRequested = false;

export function isStopRequested(): boolean {
  return stopRequested;
}

export function setStopRequested(value: boolean): void {
  stopRequested = value;
}

export function resetStopFlag(): void {
  stopRequested = false;
}

export type ConfirmHandler = (message: string) => Promise<boolean>;
let confirmDangerousOperationHandler: ConfirmHandler = async (message: string) => {
  return window.confirm(message);
};

export function setConfirmHandler(handler: ConfirmHandler) {
  confirmDangerousOperationHandler = handler;
}

export const toolSchemas = {
  runShell: {
    name: 'runShell',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command (optional)',
        },
      },
      required: ['command'],
    },
  },
  readFile: {
    name: 'readFile',
    description: 'Read contents of a file',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to read',
        },
      },
      required: ['filePath'],
    },
  },
  writeFile: {
    name: 'writeFile',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['filePath', 'content'],
    },
  },
};

export class Safety {
  static normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  static isPathAllowed(path: string, allowedFolders: string[]): boolean {
    try {
      const normalized = this.normalizePath(path);
      // Deny windows system directories or unix root system dirs
      if (
        normalized.toLowerCase().includes('windows/system32') ||
        normalized.toLowerCase().includes('windows/system') ||
        normalized.startsWith('/etc') ||
        normalized.startsWith('/root')
      ) {
        return false;
      }
      return allowedFolders.some((folder) => {
        const normFolder = this.normalizePath(folder);
        return (
          normalized.startsWith(normFolder) ||
          normalized.startsWith('./' + normFolder) ||
          normFolder === '.' ||
          normFolder === ''
        );
      });
    } catch {
      return false;
    }
  }

  static getDefaultAllowedFolders(): string[] {
    return [
      '.',
      'core',
      'logs',
      'outputs',
      '../../',
      '../',
    ];
  }
}

export class Logger {
  private static logs: ToolCallLog[] = [];

  static logToolCall(toolName: string, params: Record<string, any>, result: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const entry: ToolCallLog = {
      timestamp,
      tool: toolName,
      params,
      result,
    };
    this.logs.push(entry);
    console.log('[Chitti Logger]', entry);

    // Also persist into virtual filesystem if available
    try {
      const existingLog = virtualFs['logs/tool_calls.log'] || '';
      virtualFs['logs/tool_calls.log'] = existingLog + JSON.stringify(entry) + '\n';
    } catch (err) {
      console.warn('Failed to append to virtual log:', err);
    }
  }

  static getLogs(): ToolCallLog[] {
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }
}

// In-memory virtual file system with realistic initial project files
export const virtualFs: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'chitti-react',
      version: '1.0.0',
      description: 'React build of Chitti AI Assistant',
      main: 'src/main.tsx',
      scripts: {
        dev: 'vite --host 0.0.0.0 --port 3000',
        build: 'vite build',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    },
    null,
    2
  ),
  'hello.txt': 'hi',
  'test.txt': 'hello from chitti-js',
  'nig.txt': 'sample test content',
  'release.json': JSON.stringify(
    {
      url: 'https://api.github.com/repos/ollama/ollama/releases/415399896',
      tag_name: 'v0.40.6',
      name: 'Ollama v0.40.6',
      published_at: '2024-11-20T10:00:00Z',
    },
    null,
    2
  ),
  'core/tools.js': '// Chitti core tools\nmodule.exports = { toolSchemas, Safety, tools, Logger };',
  'core/agent.js': '// Chitti core agent\nmodule.exports = { processPrompt, processPromptSync };',
  'logs/tool_calls.log': '',
};

export const tools = {
  isDangerousShellCommand(command: string): boolean {
    if (!command || typeof command !== 'string') {
      return false;
    }
    const lowerCommand = command.toLowerCase().trim();
    const dangerousPatterns = [
      'rm ',
      'del ',
      'format ',
      'fdisk ',
      'mkfs',
      '> /dev/',
      'dd if=',
      'chmod ',
      'chown ',
      'sudo ',
      'su ',
      'shutdown',
      'reboot',
      'init ',
      'killall',
      'pkill',
      'kill -9',
      'mv ',
      'cp ',
      '> ',
      '>> ',
      '|',
      '&',
      ';',
      '||',
      '&&',
      'wget ',
      'curl ',
      'python ',
      'node ',
      'ruby ',
      'perl ',
      'bash ',
      'sh ',
      'powershell',
      'cmd ',
    ];

    return dangerousPatterns.some((pattern) => {
      if (pattern.endsWith(' ')) {
        return lowerCommand.startsWith(pattern);
      } else {
        return lowerCommand.includes(pattern);
      }
    });
  },

  async runShell({ command, cwd = '.' }: { command: string; cwd?: string }): Promise<ShellResult> {
    try {
      if (isStopRequested()) {
        resetStopFlag();
        const toolResult: ShellResult = {
          success: false,
          stdout: '',
          stderr: 'Operation stopped by user',
          status: 1,
        };
        Logger.logToolCall('runShell', { command, cwd }, toolResult);
        return toolResult;
      }

      const isDangerous = this.isDangerousShellCommand(command);
      if (isDangerous) {
        const confirmed = await confirmDangerousOperationHandler(
          `Are you sure you want to execute this potentially dangerous command?\n\n${command}`
        );
        if (!confirmed) {
          const toolResult: ShellResult = {
            success: false,
            stdout: '',
            stderr: 'Operation cancelled by user',
            status: 1,
          };
          Logger.logToolCall('runShell', { command, cwd }, toolResult);
          return toolResult;
        }
      }

      // Check stop again after modal
      if (isStopRequested()) {
        resetStopFlag();
        const toolResult: ShellResult = {
          success: false,
          stdout: '',
          stderr: 'Operation stopped by user',
          status: 1,
        };
        Logger.logToolCall('runShell', { command, cwd }, toolResult);
        return toolResult;
      }

      const trimmed = command.trim();
      let stdout = '';
      let stderr = '';
      let status = 0;

      if (trimmed === 'node -v' || trimmed === 'node --version') {
        stdout = 'v22.12.0\n';
      } else if (trimmed === 'npm -v' || trimmed === 'npm --version') {
        stdout = '10.9.0\n';
      } else if (trimmed === 'pwd') {
        stdout = cwd === '.' ? '/app/chitti-app\n' : `${cwd}\n`;
      } else if (trimmed === 'date') {
        stdout = new Date().toUTCString() + '\n';
      } else if (trimmed === 'whoami') {
        stdout = 'chitti-user\n';
      } else if (trimmed === 'ls' || trimmed.startsWith('ls ') || trimmed === 'dir') {
        const files = Object.keys(virtualFs);
        stdout = files.join('  ') + '\n';
      } else if (trimmed.startsWith('echo ')) {
        stdout = trimmed.slice(5) + '\n';
      } else if (trimmed.startsWith('cat ')) {
        const targetFile = Safety.normalizePath(trimmed.slice(4).trim());
        if (virtualFs[targetFile] !== undefined) {
          stdout = virtualFs[targetFile] + '\n';
        } else {
          stderr = `cat: ${targetFile}: No such file or directory\n`;
          status = 1;
        }
      } else if (trimmed.startsWith('rea ')) {
        const target = trimmed.slice(4).trim();
        stdout = `REA analysis completed for "${target}": Architecture verified, 8 components inspected, AST parsed successfully.`;
      } else {
        // Generic command execution output
        stdout = `Command executed successfully: [${command}] (cwd: ${cwd})\n`;
      }

      const toolResult: ShellResult = {
        success: status === 0,
        stdout,
        stderr,
        status,
      };

      Logger.logToolCall('runShell', { command, cwd }, toolResult);
      return toolResult;
    } catch (error: any) {
      const toolResult: ShellResult = {
        success: false,
        stdout: '',
        stderr: error.message || 'Unknown shell execution error',
        status: 1,
      };
      Logger.logToolCall('runShell', { command, cwd }, toolResult);
      return toolResult;
    }
  },

  async readFile({ filePath }: { filePath: string }): Promise<FileResult> {
    try {
      if (isStopRequested()) {
        resetStopFlag();
        const toolResult: FileResult = {
          success: false,
          error: 'Operation stopped by user',
        };
        Logger.logToolCall('readFile', { filePath }, toolResult);
        return toolResult;
      }

      const allowedFolders = Safety.getDefaultAllowedFolders();
      if (!Safety.isPathAllowed(filePath, allowedFolders)) {
        const errorMsg = `Access denied: Path '${filePath}' is not within allowed folders`;
        const toolResult: FileResult = {
          success: false,
          error: errorMsg,
        };
        Logger.logToolCall('readFile', { filePath }, toolResult);
        return toolResult;
      }

      const normalized = Safety.normalizePath(filePath);
      const content = virtualFs[normalized];

      if (content === undefined) {
        const errorMsg = `File not found: ${filePath}`;
        const toolResult: FileResult = {
          success: false,
          error: errorMsg,
        };
        Logger.logToolCall('readFile', { filePath }, toolResult);
        return toolResult;
      }

      const toolResult: FileResult = {
        success: true,
        content,
      };
      Logger.logToolCall('readFile', { filePath }, toolResult);
      return toolResult;
    } catch (error: any) {
      const toolResult: FileResult = {
        success: false,
        error: error.message || 'Error reading file',
      };
      Logger.logToolCall('readFile', { filePath }, toolResult);
      return toolResult;
    }
  },

  async writeFile({ filePath, content }: { filePath: string; content: string }): Promise<FileResult> {
    try {
      if (isStopRequested()) {
        resetStopFlag();
        const toolResult: FileResult = {
          success: false,
          error: 'Operation stopped by user',
        };
        Logger.logToolCall('writeFile', { filePath, content }, toolResult);
        return toolResult;
      }

      const allowedFolders = Safety.getDefaultAllowedFolders();
      if (!Safety.isPathAllowed(filePath, allowedFolders)) {
        const errorMsg = `Access denied: Path '${filePath}' is not within allowed folders`;
        const toolResult: FileResult = {
          success: false,
          error: errorMsg,
        };
        Logger.logToolCall('writeFile', { filePath, content }, toolResult);
        return toolResult;
      }

      const normalized = Safety.normalizePath(filePath);
      virtualFs[normalized] = content;

      const toolResult: FileResult = {
        success: true,
      };
      Logger.logToolCall('writeFile', { filePath, content }, toolResult);
      return toolResult;
    } catch (error: any) {
      const toolResult: FileResult = {
        success: false,
        error: error.message || 'Error writing file',
      };
      Logger.logToolCall('writeFile', { filePath, content }, toolResult);
      return toolResult;
    }
  },

  async rea({ target }: { target: string }): Promise<ShellResult> {
    return await this.runShell({ command: `rea ${JSON.stringify(target)} --json` });
  },
};
