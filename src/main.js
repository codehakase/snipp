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
    if (statusEl && infoEl) {
      updateInfo('🔄 Taking screenshot...');
      updateStatus('📸 Capturing screenshot...', 'info');
    }
    
    const result = await invoke('capture_screenshot');
    console.log('Screenshot captured:', result);
    
    if (statusEl && infoEl) {
      updateStatus('✅ Screenshot captured successfully!', 'ready');
      updateInfo(`📁 Saved to: ${result.file_path}`);
      
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

async function openPreferences() {
  try {
    await invoke('open_preferences_window');
  } catch (error) {
    console.error('Failed to open preferences:', error);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  updateStatus('🔄 Registering global shortcuts...', 'info');
  
  try {
    let config;
    try {
      config = await invoke('get_config');
    } catch (error) {
      console.log('Using default config');
      config = {
        capture_hotkey: 'Cmd+Shift+2',
        preferences_hotkey: 'Cmd+Comma'
      };
    }
    
    await register(config.capture_hotkey, captureScreenshot);
    await register(config.preferences_hotkey, openPreferences);
    
    console.log('Global shortcuts registered:', config.capture_hotkey, config.preferences_hotkey);
    updateStatus('🟢 Ready - Press ⌘⇧2 or use test button', 'ready');
    updateInfo('Global shortcuts are active! ⌘⇧2 for capture, ⌘, for preferences');
    
  } catch (error) {
    console.error('Failed to register global shortcuts:', error);
    updateStatus(`❌ Failed to register shortcuts: ${error}`, 'error');
    updateInfo('Check Accessibility permissions in System Preferences');
  }

  const testButton = document.getElementById('test-screenshot');
  const preferencesButton = document.getElementById('preferences-btn');
  const hideButton = document.getElementById('hide-window');
  
  testButton.addEventListener('click', captureScreenshot);
  preferencesButton.addEventListener('click', openPreferences);
  
  hideButton.addEventListener('click', async () => {
    const currentWindow = getCurrentWindow();
    await currentWindow.hide();
  });
});
