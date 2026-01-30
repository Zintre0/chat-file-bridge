const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// --- NASA-STYLE LOGGER ---
const COLORS = {
  RESET: '\x1b[0m',
  BLUE: '\x1b[34m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  BOLD: '\x1b[1m'
};

class MissionControl {
  static timestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
  }

  static log(level, emoji, message, meta = '') {
    const time = this.timestamp();
    let color = COLORS.WHITE;
    switch(level) {
      case 'INFO': color = COLORS.BLUE; break;
      case 'SUCCESS': color = COLORS.GREEN; break;
      case 'WARN': color = COLORS.YELLOW; break;
      case 'ERROR': color = COLORS.RED; break;
      case 'DEBUG': color = COLORS.MAGENTA; break;
      case 'TELEMETRY': color = COLORS.CYAN; break;
    }
    
    console.log(`${COLORS.BOLD}[${time}] [${level}]${COLORS.RESET} ${emoji}  ${color}${message}${COLORS.RESET} ${meta ? `\n${COLORS.WHITE}   └─> ${JSON.stringify(meta)}${COLORS.RESET}` : ''}`);
  }

  static info(msg, meta) { this.log('INFO', 'ℹ️ ', msg, meta); }
  static success(msg, meta) { this.log('SUCCESS', '✅', msg, meta); }
  static warn(msg, meta) { this.log('WARN', '⚠️ ', msg, meta); }
  static error(msg, meta) { this.log('ERROR', '💥', msg, meta); }
  static debug(msg, meta) { this.log('DEBUG', '🛠️ ', msg, meta); }
  static telemetry(msg, meta) { this.log('TELEMETRY', '📡', msg, meta); }
}

// --- FILE HANDLER CLASS ---
class FileHandler {
  constructor(config) {
    this.projectRoot = null;
    this.backupDir = path.join(__dirname, '.backups');
    this.config = config || {};
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      MissionControl.debug(`Backup directory created at ${this.backupDir}`);
    }
  }

  setProjectRoot(rootPath) {
    const resolved = path.resolve(rootPath);
    if (!fs.existsSync(resolved)) {
      MissionControl.error(`Root path validation failed: ${resolved}`);
      throw new Error(`Path does not exist: ${resolved}`);
    }
    if (!fs.statSync(resolved).isDirectory()) {
       MissionControl.error(`Root path is not a directory: ${resolved}`);
       throw new Error(`Not a directory: ${resolved}`);
    }
    this.projectRoot = resolved;
    MissionControl.success(`Target system locked: ${resolved}`);
    return resolved;
  }

  resolvePath(filePath) {
    if (!this.projectRoot) throw new Error('Project root not set. Enable File Bridge first.');
    const resolved = path.resolve(this.projectRoot, filePath);
    if (!resolved.startsWith(this.projectRoot)) throw new Error('Access denied: Path outside project root');
    return resolved;
  }

  async read(filePath) {
    MissionControl.debug(`Reading artifact: ${filePath}`);
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);
    const stats = fs.statSync(fullPath);
    if (stats.size > 1024 * 1024) throw new Error('File too large (max 1MB)');
    return { success: true, file: filePath, content: fs.readFileSync(fullPath, 'utf8') };
  }

  async write(filePath, content) {
    MissionControl.debug(`Writing artifact: ${filePath} (${content.length} bytes)`);
    const fullPath = this.resolvePath(filePath);
    if (fs.existsSync(fullPath)) await this.backup(fullPath);
    fs.writeFileSync(fullPath, content, 'utf8');
    MissionControl.success(`Artifact saved: ${filePath}`);
    return { success: true, file: filePath };
  }

  async list(dirPath = '.') {
    MissionControl.debug(`Scanning sector: ${dirPath}`);
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
    MissionControl.info(`Backup secured: ${path.basename(backupPath)}`);
  }
}

// --- TERMINAL SERVER ---
const wss = new WebSocket.Server({ port: 9092 });
const fileHandler = new FileHandler({ autoCommit: false });

MissionControl.info(`Mission Control initialized. Listening on port 9092...`);
MissionControl.telemetry('Waiting for satellite connection...');

wss.on('connection', (ws) => {
  MissionControl.success('Satellite docked (Client Connected)');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      MissionControl.telemetry(`Packet received: ${data.type}`);

      // Handle File Bridge Enable
      if (data.type === 'fileBridgeEnable') {
        try {
          fileHandler.setProjectRoot(data.projectRoot);
        } catch (e) {
          MissionControl.error(e.message);
        }
        return;
      }

      // Handle File Commands
      if (data.type === 'fileBridgeCommand') {
        const { command, args, content } = data;
        MissionControl.info(`Executing maneuver: ${command.toUpperCase()}`, { args });
        let result;

        try {
          switch (command) {
            case 'read': result = await fileHandler.read(args); break;
            case 'write': result = await fileHandler.write(args, content); break;
            case 'list': result = await fileHandler.list(args); break;
            default: result = { success: false, error: 'Unknown command' };
          }
        } catch (err) {
          MissionControl.error(`Maneuver failed: ${err.message}`);
          result = { success: false, error: err.message };
        }

        ws.send(JSON.stringify({
          type: 'fileBridgeResponse',
          command: command,
          ...result
        }));
        MissionControl.telemetry(`Response sent for ${command}`);
      }
    } catch (error) {
      MissionControl.error('Signal processing error', error);
    }
  });
  
  ws.on('close', () => {
    MissionControl.warn('Satellite undocked (Client Disconnected)');
  });
});
