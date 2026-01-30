// --- FILE BRIDGE CLIENT ---
// NASA-Style Debugging & UI Injection

// Console "Splash Screen"
console.log('%c🚀 File Bridge Initializing...', 'font-weight: bold; font-size: 14px; color: #4CAF50;');

(function() {
  const LOG_PREFIX = '%c[Mission Control]';
  const LOG_STYLE = 'color: #2196F3; font-weight: bold;';
  
  function debug(msg, type='info') {
    const icon = type === 'error' ? '💥' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${LOG_PREFIX} ${icon} ${msg}`, LOG_STYLE);
  }

  // Wait for body to be available
  function init() {
    if (!document.body) {
      setTimeout(init, 100);
      return;
    }
    
    // Check if already injected
    if (document.getElementById('file-bridge-ui')) {
      debug('Modules already active', 'info');
      return;
    }
    
    debug('Injecting HUD interface...', 'info');
    createUI();
    setupObservers();
  }

  function createUI() {
	  // --- UI Creation with Drag & Drop ---
	  const ui = document.createElement('div');
	  ui.id = 'file-bridge-ui';
	  ui.style.cssText = `
	    position: fixed;
	    bottom: 20px;
	    right: 20px;
	    background: rgba(10, 15, 30, 0.95);
	    color: #e0e0e0;
	    padding: 10px;
	    border-radius: 4px;
	    z-index: 9999;
	    border: 1px solid #2196F3;
	    font-family: 'Courier New', monospace;
	    min-width: 320px;
	    cursor: move;
	    user-select: none;
	    backdrop-filter: blur(5px);
	    box-shadow: 0 0 15px rgba(33, 150, 243, 0.3);
	  `;
	  
	  ui.innerHTML = `
	    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
	      <strong style="color: #2196F3;">🛰️ FILE BRIDGE</strong>
	      <div style="font-size: 12px;">
	        <button id="fb-minimize" style="background: transparent; border: none; color: #aaa; cursor: pointer; margin-right: 5px;">−</button>
	        <button id="fb-close" style="background: transparent; border: none; color: #aaa; cursor: pointer;">×</button>
	      </div>
	    </div>
	    
	    <div style="margin-bottom: 10px;">
	      <div style="font-size: 10px; color: #888; margin-bottom: 3px; text-transform: uppercase;">Target Sector (Root Path)</div>
	      <input id="fb-root" placeholder="/path/to/project" 
	             style="background: #1a1a1a; color: #0f0; border: 1px solid #333; padding: 6px; width: 100%; border-radius: 2px; font-size: 12px; font-family: monospace;">
	    </div>
	    
	    <div style="margin-bottom: 10px;">
	      <div style="font-size: 10px; color: #888; margin-bottom: 3px; text-transform: uppercase;">Comms Link (Target Element)</div>
	      <div id="fb-target-info" 
	           style="background: #1a1a1a; padding: 6px; border-radius: 2px; border: 1px dashed #444; font-size: 11px; min-height: 20px; cursor: pointer;">
	        <em style="color: #666;">Waiting for target lock...</em>
	      </div>
	    </div>
	    
	    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
	      <button id="fb-enable" style="flex: 1; background: #1b5e20; border: 1px solid #2e7d32; padding: 8px; cursor: pointer; border-radius: 2px; color: #fff; font-size: 11px; text-transform: uppercase;">Engage System</button>
	      <button id="fb-select" style="flex: 1; background: #0d47a1; border: 1px solid #1565c0; padding: 8px; cursor: pointer; border-radius: 2px; color: #fff; font-size: 11px; text-transform: uppercase;">Acquire Target</button>
	    </div>
	    
	    <div id="fb-status" style="font-size: 10px; color: #888; margin-top: 5px; min-height: 16px; border-top: 1px solid #333; padding-top: 5px;">
        STATUS: STANDBY
      </div>
	    
	    <!-- Command Palette (hidden by default) -->
	    <div id="fb-commands" style="display: none; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;">
	      <div style="font-size: 10px; color: #888; margin-bottom: 5px; text-transform: uppercase;">Quick Protocols:</div>
	      <button class="fb-cmd-btn" data-cmd="@list ." style="background: #333; border: 1px solid #444; color: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 2px; font-size: 10px; cursor: pointer; font-family: monospace;">LS ROOT</button>
	      <button class="fb-cmd-btn" data-cmd="@list src/" style="background: #333; border: 1px solid #444; color: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 2px; font-size: 10px; cursor: pointer; font-family: monospace;">LS SRC</button>
	      <button class="fb-cmd-btn" data-cmd="@read package.json" style="background: #333; border: 1px solid #444; color: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 2px; font-size: 10px; cursor: pointer; font-family: monospace;">READ PKG</button>
	    </div>
	  `;
	  
	  document.body.appendChild(ui);
    setupInteractions(ui);
  }

  function setupInteractions(ui) {
	  // --- State Management ---
	  const state = {
	    isDragging: false,
	    dragOffset: { x: 0, y: 0 },
	    targetElement: null,
	    isSelectingTarget: false,
	    isMinimized: false,
	    projectRoot: ''
	  };
	  
	  // --- Drag & Drop Functionality ---
	  ui.addEventListener('mousedown', (e) => {
	    if (e.target === ui || e.target.tagName === 'STRONG') {
	      state.isDragging = true;
	      const rect = ui.getBoundingClientRect();
	      state.dragOffset.x = e.clientX - rect.left;
	      state.dragOffset.y = e.clientY - rect.top;
	      ui.style.opacity = '0.8';
	      e.preventDefault();
	    }
	  });
	  
	  document.addEventListener('mousemove', (e) => {
	    if (state.isDragging) {
	      ui.style.left = (e.clientX - state.dragOffset.x) + 'px';
	      ui.style.top = (e.clientY - state.dragOffset.y) + 'px';
	      ui.style.right = 'auto';
	      ui.style.bottom = 'auto';
	    }
	  });
	  
	  document.addEventListener('mouseup', () => {
	    if (state.isDragging) {
	      state.isDragging = false;
	      ui.style.opacity = '1';
	      savePosition();
	    }
	  });
	  
	  function savePosition() {
	    const rect = ui.getBoundingClientRect();
	    localStorage.setItem('fileBridgePosition', JSON.stringify({
	      left: rect.left,
	      top: rect.top
	    }));
	  }
	  
	  function loadPosition() {
	    const saved = localStorage.getItem('fileBridgePosition');
	    if (saved) {
	      const pos = JSON.parse(saved);
	      ui.style.left = pos.left + 'px';
	      ui.style.top = pos.top + 'px';
	      ui.style.right = 'auto';
	      ui.style.bottom = 'auto';
	    }
	  }
	  
	  // --- Target Element Selection ---
	  function startElementSelection() {
	    state.isSelectingTarget = true;
	    document.getElementById('fb-target-info').innerHTML = 
	      '<span style="color: #2196F3;">ACQUIRING... CLICK ELEMENT (ESC CANCEL)</span>';
	    document.getElementById('fb-target-info').style.borderColor = '#2196F3';
	    
	    // Add selection overlay
	    const overlay = document.createElement('div');
	    overlay.id = 'fb-selection-overlay';
	    overlay.style.cssText = `
	      position: fixed;
	      top: 0;
	      left: 0;
	      width: 100%;
	      height: 100%;
	      background: rgba(33, 150, 243, 0.1);
	      z-index: 9998;
	      cursor: crosshair;
	    `;
	    document.body.appendChild(overlay);
	    
	    // Highlight on hover
	    document.addEventListener('mouseover', highlightElement, true);
	    overlay.addEventListener('click', stopElementSelection);
	  }
	  
	  function highlightElement(e) {
	    if (!state.isSelectingTarget) return; 
	    
	    // Skip if hovering over File Bridge UI elements
	    if (e.target.closest('#file-bridge-ui')) {
	      // Remove any existing highlight
	      const prev = document.querySelector('.fb-highlight');
	      if (prev) prev.classList.remove('fb-highlight');
	      return;
	    }
	    
	    // Remove previous highlight
	    const prev = document.querySelector('.fb-highlight');
	    if (prev) prev.classList.remove('fb-highlight');
	    
	    // Add highlight to current element
	    e.target.classList.add('fb-highlight');
	    e.target.style.outline = '2px solid #2196F3';
	    e.target.style.outlineOffset = '2px';
	    
	    e.stopPropagation();
	  }
	
	  function stopElementSelection(e) {
	    if (!state.isSelectingTarget) return;
	    
	    // Cancel if clicking on File Bridge UI
	    if (e.target.closest('#file-bridge-ui')) {
	      cancelElementSelection();
	      return;
	    }
	    
	    // If clicking the overlay, find the element underneath
	    let targetElement;
	    if (e.target.id === 'fb-selection-overlay') {
	      // Get element at click position (under the overlay)
	      const elements = document.elementsFromPoint(e.clientX, e.clientY);
	      // Skip the overlay and any File Bridge UI elements
	      targetElement = elements.find(el => 
	        el.id !== 'fb-selection-overlay' && 
	        !el.closest('#file-bridge-ui')
	      );
	    } else {
	      targetElement = e.target;
	    }
	    
	    if (!targetElement) {
	      cancelElementSelection();
	      return;
	    }
	    
	    state.isSelectingTarget = false;
	    state.targetElement = targetElement;
	    
	    // Save target element info
	    const tag = state.targetElement.tagName.toLowerCase();
	    const id = state.targetElement.id ? `#${state.targetElement.id}` : '';
	    const classes = state.targetElement.className ? `.${state.targetElement.className.split(' ').join('.')}` : '';
	    
	    document.getElementById('fb-target-info').innerHTML = 
	      `<span style="color: #4CAF50;">✓ LOCKED: ${tag}${id}${classes}</span>`;
	    document.getElementById('fb-target-info').style.borderColor = '#4CAF50';
	    
	    // Cleanup
	    const overlay = document.getElementById('fb-selection-overlay');
	    if (overlay) overlay.remove();
	    
	    document.removeEventListener('mouseover', highlightElement, true);
	    
	    const highlighted = document.querySelector('.fb-highlight');
	    if (highlighted) {
	      highlighted.classList.remove('fb-highlight');
	      highlighted.style.outline = '';
	    }
	    
	    // Save to storage
	    localStorage.setItem('fileBridgeTarget', JSON.stringify({
	      selector: getElementSelector(state.targetElement)
	    }));
	    
	    updateStatus('TARGET ACQUIRED', 'success');
	  }
	  
	  function cancelElementSelection() {
	    if (!state.isSelectingTarget) return;
	    
	    state.isSelectingTarget = false;
	    
	    document.getElementById('fb-target-info').innerHTML = 
	      '<em style="color: #888;">Selection cancelled</em>';
	    document.getElementById('fb-target-info').style.borderColor = '#555';
	    
	    // Cleanup
	    const overlay = document.getElementById('fb-selection-overlay');
	    if (overlay) overlay.remove();
	    
	    document.removeEventListener('mouseover', highlightElement, true);
	    
	    const highlighted = document.querySelector('.fb-highlight');
	    if (highlighted) {
	      highlighted.classList.remove('fb-highlight');
	      highlighted.style.outline = '';
	    }
	    
	    updateStatus('SCAN ABORTED', 'warning');
	  }
	  
	  function getElementSelector(element) {
	    if (element.id) return `#${element.id}`;
	    
	    let selector = element.tagName.toLowerCase();
	    if (element.className) {
	      selector += '.' + element.className.split(' ').join('.');
	    }
	    
	    // Try to make it more specific
	    const siblings = element.parentNode ? Array.from(element.parentNode.children) : [];
	    const sameTag = siblings.filter(el => el.tagName === element.tagName);
	    if (sameTag.length > 1) {
	      const index = sameTag.indexOf(element);
	      selector += `:nth-child(${index + 1})`;
	    }
	    
	    return selector;
	  }
	  
	  function loadTargetElement() {
	    const saved = localStorage.getItem('fileBridgeTarget');
	    if (saved) {
	      try {
	        const { selector } = JSON.parse(saved);
	        const element = document.querySelector(selector);
	        if (element) {
	          state.targetElement = element;
	          document.getElementById('fb-target-info').innerHTML = 
	            `<span style="color: #4CAF50;">✓ RE-LOCKED</span>`;
	        }
	      } catch (e) {
	        console.warn('Failed to load target element:', e);
	      }
	    }
	  }
	  
	  // --- Content Insertion into Target ---
	  function insertIntoTarget(content, isCode = true) {
	    if (!state.targetElement) {
	      // Fallback to active element
	      const active = document.activeElement;
	      if (active && (active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
	        return insertAtCursor(active, content);
	      }
	      alert('Please select a target element first!');
	      return false;
	    }
	    
	    const target = state.targetElement;
	    const formattedContent = isCode ? `\n\
${content}\n\
` : `\n${content}\n`;
	    
	    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
	      target.value += formattedContent;
	      target.dispatchEvent(new Event('input', { bubbles: true }));
	      target.dispatchEvent(new Event('change', { bubbles: true }));
	    } else if (target.getAttribute('contenteditable') === 'true' || target.isContentEditable) {
	      const selection = window.getSelection();
	      const range = document.createRange();
	      
	      // Try to insert at cursor, otherwise append
	      if (selection.rangeCount > 0) {
	        range.setStart(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
	        range.deleteContents();
	        range.insertNode(document.createTextNode(formattedContent));
	        selection.removeAllRanges();
	        selection.addRange(range);
	      } else {
	        target.innerHTML += formattedContent;
	      }
	      
	      // Trigger input event for React/Vue
	      target.dispatchEvent(new Event('input', { bubbles: true }));
	    } else {
	      // For other elements, append as text
	      target.textContent += formattedContent;
	    }
	    
	    // Scroll to show inserted content
	    target.scrollTop = target.scrollHeight;
	    
	    return true;
	  }
	  
	  function insertAtCursor(element, text) {
	    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
	      const start = element.selectionStart;
	      const end = element.selectionEnd;
	      element.value = element.value.substring(0, start) + text + element.value.substring(end);
	      element.selectionStart = element.selectionEnd = start + text.length;
	      element.dispatchEvent(new Event('input', { bubbles: true }));
	    } else if (element.getAttribute('contenteditable') === 'true') {
	      document.execCommand('insertText', false, text);
	    }
	  }
	  
	  // --- UI Event Handlers ---
	  document.getElementById('fb-enable').onclick = () => {
	    const root = document.getElementById('fb-root').value;
	    if (!root.trim()) {
	      updateStatus('ERR: NO ROOT PATH', 'error');
	      return;
	    }
	    
	    state.projectRoot = root;
	    chrome.runtime.sendMessage({ type: 'fileBridgeEnable', projectRoot: root });
	    updateStatus(`SYSTEM ACTIVE`, 'success');
	    localStorage.setItem('fileBridgeRoot', root);
	    
	    // Show command palette
	    document.getElementById('fb-commands').style.display = 'block';
	  };
	  
	  document.getElementById('fb-select').onclick = startElementSelection;
	  
	  document.getElementById('fb-minimize').onclick = () => {
	    state.isMinimized = !state.isMinimized;
	    if (state.isMinimized) {
	      ui.style.height = '40px';
	      ui.style.overflow = 'hidden';
	      document.getElementById('fb-minimize').textContent = '+';
	    } else {
	      ui.style.height = 'auto';
	      ui.style.overflow = 'visible';
	      document.getElementById('fb-minimize').textContent = '−';
	    }
	  };
	  
	  document.getElementById('fb-close').onclick = () => {
	    ui.style.display = 'none';
	    localStorage.setItem('fileBridgeVisible', 'false');
	  };
	  
	  // Quick command buttons
	  document.addEventListener('click', (e) => {
	    if (e.target.classList.contains('fb-cmd-btn')) {
	      const cmd = e.target.getAttribute('data-cmd');
	      const active = document.activeElement;
	      if (active && (active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
	        insertAtCursor(active, cmd + ' ');
	        active.focus();
	      }
	    }
	  });
	  
	  // Escape key cancels selection
	  document.addEventListener('keydown', (e) => {
	    if (e.key === 'Escape' && state.isSelectingTarget) {
	      cancelElementSelection();
	    }
	  });
	  
	  // --- Command Interception (Enhanced) ---
	  document.addEventListener('keydown', (e) => {
	    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
	      const target = e.target;
	      if (target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true') {
	        const text = target.value || target.innerText || target.textContent;
	        
	        const readMatch = text.match(/@read\s+(.+)/);
	        const writeMatch = text.match(/@write\s+(.+)/);
	        const listMatch = text.match(/@list\s*(.*)/);

	        if (readMatch || listMatch || writeMatch) {
	          e.preventDefault();
	          e.stopImmediatePropagation();
	          
	          let commandData;
	          if (readMatch) {
	            commandData = { type: 'fileBridgeCommand', command: 'read', args: readMatch[1].trim() };
	          } else if (listMatch) {
	            commandData = { type: 'fileBridgeCommand', command: 'list', args: listMatch[1].trim() || '.' };
	          } else if (writeMatch) {
	            // For @write, we need to get the content
	            const lines = text.split('\n');
	            const writeLineIndex = lines.findIndex(line => line.includes('@write'));
	            if (writeLineIndex !== -1) {
	              const content = lines.slice(writeLineIndex + 1).join('\n').trim();
	              commandData = { 
	                type: 'fileBridgeCommand', 
	                command: 'write', 
	                args: writeMatch[1].trim(), 
	                content: content 
	              };
	            }
	          }
	          
	          if (commandData) {
            debug(`Sending command: ${commandData.command}`, 'info');
            updateStatus(`TRANSMITTING ${commandData.command.toUpperCase()}...`, 'warning');
            
	            chrome.runtime.sendMessage(commandData, (response) => {
	              if (chrome.runtime.lastError) {
	                updateStatus('COMMS ERROR', 'error');
	              }
	            });
	          }
	          
	          return false;
	        }
	      }
	    }
	  }, true);
	  
	  // --- Response Handler (Enhanced) ---
	  chrome.runtime.onMessage.addListener((msg) => {
	    if (msg.type === 'fileBridgeResponse') {
	      if (msg.success) {
	        if (msg.command === 'read') {
	          // Insert content into target element
	          const inserted = insertIntoTarget(msg.content, true);
	          if (inserted) {
	            updateStatus(`RECEIVED DATA: ${msg.file}`, 'success');
	          }
	        } else if (msg.command === 'list') {
	          // Show files in a nicer format
	          const fileList = msg.files.map(f => `  ${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n');
	          const output = `Files in ${msg.args || '.'}:\n${fileList}`;
	          insertIntoTarget(output, false);
	          updateStatus(`SCAN COMPLETE: ${msg.files.length} ITEMS`, 'success');
	        } else if (msg.command === 'write') {
	          updateStatus(`UPLOAD COMPLETE: ${msg.file}`, 'success');
	        }
	      } else {
	        updateStatus(`ERR: ${msg.error}`, 'error');
	        // Still try to insert error message into target
	        insertIntoTarget(`Error: ${msg.error}`, false);
	      }
	    }
	  });
	  
	  // --- Utility Functions ---
	  function updateStatus(text, type = 'info') {
	    const status = document.getElementById('fb-status');
	    status.innerText = text;
	    status.style.color = 
	      type === 'success' ? '#4CAF50' : 
	      type === 'error' ? '#F44336' : 
	      type === 'warning' ? '#FF9800' : '#888';
	  }
	  
	  // --- Initialization ---
	  function initUI() {
	    // Load saved position
	    loadPosition();
	    
	    // Load saved root
	    const savedRoot = localStorage.getItem('fileBridgeRoot');
	    if (savedRoot) {
	      document.getElementById('fb-root').value = savedRoot;
	      state.projectRoot = savedRoot;
	    }
	    
	    // Load saved target
	    loadTargetElement();
	    
	    // Check if previously hidden (default to true)
	    if (localStorage.getItem('fileBridgeVisible') === 'false') {
	      ui.style.display = 'none';
	    } else {
        ui.style.display = 'block';
        localStorage.setItem('fileBridgeVisible', 'true');
      }
	    
	    updateStatus('SYSTEM ONLINE. AWAITING INPUT.', 'success');
	    
	    // Add Keyboard Toggle (Alt + F)
      document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'f') {
          const isHidden = ui.style.display === 'none';
          ui.style.display = isHidden ? 'block' : 'none';
          localStorage.setItem('fileBridgeVisible', isHidden ? 'true' : 'false');
          debug(`UI visibility toggled: ${!isHidden}`, 'info');
        }
      });
	    
	    // Add CSS for highlighting
	    const style = document.createElement('style');
	    style.textContent = `
	      .fb-highlight {
	        transition: outline 0.2s ease;
	        position: relative;
	      }
	      .fb-highlight::after {
	        content: '';
	        position: absolute;
	        top: -2px;
	        left: -2px;
	        right: -2px;
	        bottom: -2px;
	        pointer-events: none;
	      }
	      .fb-cmd-btn {
	        background: #333;
	        border: 1px solid #444;
	        color: #e0e0e0;
	        padding: 4px 8px;
	        margin: 2px;
	        border-radius: 2px;
	        font-size: 10px;
	        cursor: pointer;
          font-family: monospace;
	      }
	      .fb-cmd-btn:hover {
	        background: #444;
          border-color: #555;
	      }
	    `;
	    document.head.appendChild(style);
	  }
	  
	  initUI();
  }

  function setupObservers() {
    // Also watch for DOM changes (for SPAs)
    const observer = new MutationObserver(() => {
      if (document.body && !document.getElementById('file-bridge-ui')) {
        debug('DOM change detected. Re-initializing...', 'warn');
        init();
      }
    });
    
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  // Start initialization
  init();

})();
