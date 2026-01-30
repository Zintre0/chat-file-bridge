const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Definir colores para la consola (ANSI escape codes)
const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const NC = '\x1b[0m'; // No Color

// --- FILE HANDLER CLASS ---
class FileHandler {
  constructor(config) {
    this.projectRoot = null;
    this.backupDir = path.join(os.homedir(), '.chat-terminal-backups');
    this.config = config || {};
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
  }

  setProjectRoot(rootPath) {
    const resolved = path.resolve(rootPath);
    if (!fs.existsSync(resolved)) throw new Error(`Path does not exist: ${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new Error(`Not a directory: ${resolved}`);
    this.projectRoot = resolved;
    console.log(`${GREEN}✅ Project root set to: ${resolved}${NC}`);
    return resolved;
  }

  resolvePath(filePath) {
    if (!this.projectRoot) throw new Error('Project root not set. Enable File Bridge first.');
    const resolved = path.resolve(this.projectRoot, filePath);
    if (!resolved.startsWith(this.projectRoot)) throw new Error('Access denied: Path outside project root');
    return resolved;
  }

  async read(filePath) {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);
    const stats = fs.statSync(fullPath);
    if (stats.size > 1024 * 1024) throw new Error('File too large (max 1MB)');
    return { success: true, file: filePath, content: fs.readFileSync(fullPath, 'utf8') };
  }

  async write(filePath, content) {
    const fullPath = this.resolvePath(filePath);
    if (fs.existsSync(fullPath)) await this.backup(fullPath);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, file: filePath };
  }

  async list(dirPath = '.') {
    const fullPath = this.resolvePath(dirPath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries.filter(e => !e.name.startsWith('.')).map(e => ({
      name: e.name, type: e.isDirectory() ? 'dir' : 'file'
    }));
    return { success: true, files: files };
  }

  async backup(fullPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, path.basename(fullPath) + '.' + timestamp + '.bak');
    fs.copyFileSync(fullPath, backupPath);
  }
}

// --- TERMINAL SERVER ---
const wss = new WebSocket.Server({ port: 9092 });
const fileHandler = new FileHandler({ autoCommit: false });

console.log(`${BLUE}📡 Terminal Server running on ws://localhost:9092${NC}`);

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Handle File Bridge Enable
      if (data.type === 'fileBridgeEnable') {
        try {
          fileHandler.setProjectRoot(data.projectRoot);
        } catch (e) {
          console.error(e.message);
        }
        return;
      }

      // Handle File Commands
      if (data.type === 'fileBridgeCommand') {
        const { command, args, content } = data;
        let result;

        try {
          switch (command) {
            case 'read': result = await fileHandler.read(args); break;
            case 'write': result = await fileHandler.write(args, content); break;
            case 'list': result = await fileHandler.list(args); break;
            default: result = { success: false, error: 'Unknown command' };
          }
        } catch (err) {
          result = { success: false, error: err.message };
        }

        ws.send(JSON.stringify({
          type: 'fileBridgeResponse',
          command: command,
          ...result
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
});
