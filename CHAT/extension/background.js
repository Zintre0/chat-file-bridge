// background.js - Enhanced
let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

function connect() {
  console.log('Connecting to terminal server...');
  ws = new WebSocket('ws://localhost:9092');
  
  ws.onopen = () => { 
    isConnected = true;
    reconnectAttempts = 0;
    console.log('✅ Connected to Terminal Server');
    //updateExtensionIcon('connected');
  };
  
  ws.onclose = () => { 
    isConnected = false;
    console.log('❌ Disconnected from Terminal Server');
    //updateExtensionIcon('disconnected');
    
    // Exponential backoff reconnection
    reconnectAttempts++;
    if (reconnectAttempts <= maxReconnectAttempts) {
      const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
      setTimeout(connect, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      
      // Handle ping/pong
      if (msg.type === 'pong') return;
      
      if (msg.type === 'fileBridgeResponse') {
        // Send to all tabs (or active tab)
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, msg);
            } catch (e) {
              // Tab might not have content script
            }
          });
        });
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  };
  
  // Send periodic ping
  setInterval(() => {
    if (isConnected && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);
}

function updateExtensionIcon(state) {
  const path = state === 'connected' 
    ? 'icons/connected-128.png' 
    : 'icons/disconnected-128.png';
  chrome.action.setIcon({ path: path });
}

// Initialize connection
connect();

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fileBridgeCommand' || msg.type === 'fileBridgeEnable') {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      sendResponse({ success: true, queued: true });
    } else {
      sendResponse({ 
        success: false, 
        error: 'Not connected to terminal server',
        reconnecting: reconnectAttempts < maxReconnectAttempts
      });
    }
    return true; // Keep message channel open for async response
  }
  
  // Health check
  if (msg.type === 'healthCheck') {
    sendResponse({ 
      connected: isConnected, 
      reconnectAttempts: reconnectAttempts,
      maxReconnectAttempts: maxReconnectAttempts
    });
  }
});
