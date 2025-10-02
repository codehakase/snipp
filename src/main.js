const { invoke } = window.__TAURI__.core;
const { register } = window.__TAURI__.globalShortcut;
const { getCurrentWindow } = window.__TAURI__.window;

const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');

function updateStatus(message, type = 'info') {
  statusEl.innerHTML = `<p>${message}</p>`;
  statusEl.className = `status ${type}`;
}

function updateInfo(message) {
  infoEl.innerHTML = `<p><small>${message}</small></p>`;
}

async function captureScreenshot() {
  try {
    // Only update UI if elements exist (when called from within the app window)
    if (statusEl && infoEl) {
      updateInfo('🔄 Taking screenshot...');
      updateStatus('📸 Capturing screenshot...', 'info');
    }
    
    const result = await invoke('capture_screenshot');
    console.log('Screenshot captured:', result);
    
    if (statusEl && infoEl) {
      updateStatus('✅ Screenshot captured successfully!', 'ready');
      updateInfo(`📁 Saved to: ${result}`);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        updateStatus('🟢 Ready - Press ⌘⇧2 or use test button', 'ready');
        updateInfo('Press the global hotkey or use the test button above');
      }, 3000);
    }
    
  } catch (error) {
    console.error('Screenshot failed:', error);
    if (statusEl && infoEl) {
      updateStatus(`❌ Error: ${error}`, 'error');
      updateInfo('Try again or check permissions');
    }
  }
}

// Global shortcut registration
window.addEventListener("DOMContentLoaded", async () => {
  updateStatus('🔄 Registering global shortcut...', 'info');
  
  try {
    // Register the global shortcut for Cmd+Shift+2
    await register('Command+Shift+2', captureScreenshot);
    
    console.log('Global shortcut registered: Command+Shift+2');
    updateStatus('🟢 Ready - Press ⌘⇧2 or use test button', 'ready');
    updateInfo('Global shortcut ⌘⇧2 is active!');
    
  } catch (error) {
    console.error('Failed to register global shortcut:', error);
    updateStatus(`❌ Failed to register shortcut: ${error}`, 'error');
    updateInfo('Check Accessibility permissions in System Preferences');
  }

  // Setup UI event handlers
  const testButton = document.getElementById('test-screenshot');
  const hideButton = document.getElementById('hide-window');
  
  testButton.addEventListener('click', captureScreenshot);
  
  hideButton.addEventListener('click', async () => {
    const currentWindow = getCurrentWindow();
    await currentWindow.hide();
  });
});
