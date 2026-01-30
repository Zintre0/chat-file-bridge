#!/bin/bash

# Define colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting File Bridge System Installation...${NC}"

# 1. Create Directories
echo -e "${BLUE}📂 Creating directories...${NC}"
mkdir -p chat-terminal-project/extension
mkdir -p chat-terminal-project/server

# Enter project dir
cd chat-terminal-project || exit

# 2. Create Server Files
echo -e "${BLUE}📝 Creating Server Files...${NC}"

# Package.json
cat > server/package.json << EOL
{
  "name": "chat-terminal-server",
  "version": "1.0.0",
  "description": "Terminal server with File Bridge",
  "main": "terminal-server.js",
  "dependencies": {
    "ws": "^8.16.0"
  }
}
EOL

# Terminal Server (Complete with FileHandler)
cat > server/terminal-server.js << 'EOL'
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
    console.log(`\x1b[32m✅ Project root set to: ${resolved}\x1b[0m`);
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
const wss = new WebSocket.Server({ port: 9091 });
const fileHandler = new FileHandler({ autoCommit: false });

console.log(`${BLUE}📡 Terminal Server running on ws://localhost:9091${NC}`);

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
EOL

# 3. Create Extension Files
echo -e "${BLUE}🧩 Creating Extension Files...${NC}"

# Manifest.json
cat > extension/manifest.json << EOL
{
  "manifest_version": 3,
  "name": "File Bridge Terminal",
  "version": "1.0",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["file-bridge.js"],
      "run_at": "document_end"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
EOL

# Background.js
cat > extension/background.js << 'EOL'
let ws = null;
let isConnected = false;

function connect() {
  ws = new WebSocket('ws://localhost:9091');
  
  ws.onopen = () => { isConnected = true; console.log('Connected to Terminal'); };
  ws.onclose = () => { isConnected = false; setTimeout(connect, 3000); };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'fileBridgeResponse') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, msg);
        });
      }
    } catch (e) {}
  };
}

connect();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fileBridgeCommand' || msg.type === 'fileBridgeEnable') {
    if (isConnected) {
      ws.send(JSON.stringify(msg));
      sendResponse({queued: true});
    } else {
      sendResponse({error: 'Not connected'});
    }
    return true;
  }
});
EOL

# File-Bridge.js (Content Script)
cat > extension/file-bridge.js << 'EOL'
// UI Injection
const ui = document.createElement('div');
ui.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#222;color:#fff;padding:10px;border-radius:8px;z-index:9999;border:1px solid #4CAF50;font-family:monospace;';
ui.innerHTML = `
  <div style="margin-bottom:5px;"><strong>📁 File Bridge</strong></div>
  <input id="fb-root" placeholder="/path/to/project" style="background:#333;color:#fff;border:none;padding:5px;width:200px;">
  <button id="fb-btn" style="background:#4CAF50;border:none;padding:5px 10px;cursor:pointer;">Enable</button>
  <div id="fb-status" style="font-size:10px;color:#888;margin-top:5px;">Waiting...</div>
`;
document.body.appendChild(ui);

document.getElementById('fb-btn').onclick = () => {
  const root = document.getElementById('fb-root').value;
  chrome.runtime.sendMessage({ type: 'fileBridgeEnable', projectRoot: root });
  document.getElementById('fb-status').innerText = 'Enabled for: ' + root;
  document.getElementById('fb-status').style.color = '#4CAF50';
};

// Command Interception
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true') {
      const text = target.value || target.innerText;
      
      const readMatch = text.match(/@read\s+(.+)/);
      const writeMatch = text.match(/@write\s+(.+)/);
      const listMatch = text.match(/@list\s*(.*)/);

      if (readMatch) {
        chrome.runtime.sendMessage({ type: 'fileBridgeCommand', command: 'read', args: readMatch[1].trim() });
      } else if (listMatch) {
        chrome.runtime.sendMessage({ type: 'fileBridgeCommand', command: 'list', args: listMatch[1].trim() || '.' });
      } else if (writeMatch) {
        chrome.runtime.sendMessage({ type: 'fileBridgeCommand', command: 'write', args: writeMatch[1].trim(), content: "Placeholder content" });
      }
    }
  }
});

// Handle Responses
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'fileBridgeResponse') {
    if (msg.success) {
      if (msg.command === 'read') {
        const output = `\n\n\`\`\`\n${msg.content}\n\`\`\`\n`;
        const el = document.activeElement;
        if (el.tagName === 'TEXTAREA') el.value += output;
        else el.innerText += output;
        // Trigger input event to resize textarea/notify frameworks
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (msg.command === 'list') {
        alert('Files:\n' + msg.files.map(f => f.name).join('\n'));
      }
    } else {
      alert('Error: ' + msg.error);
    }
  }
});
EOL

# 4. Install Dependencies
echo -e "${BLUE}📦 Installing NPM dependencies...${NC}"
cd server || exit
npm install
cd ..

echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "----------------------------------------"
echo -e "1. Open Chrome/Edge -> Extensions -> Enable Developer Mode"
echo -e "2. Click 'Load Unpacked' and select: $(pwd)/extension"
echo -e "3. Start the server:"
echo -e "   ${BLUE}cd chat-terminal-project/server && node terminal-server.js${NC}"
echo -e "----------------------------------------"
