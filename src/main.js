const { invoke } = window.__TAURI__.core;
const { register } = window.__TAURI__.globalShortcut;
const { getCurrentWindow } = window.__TAURI__.window;

const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');

function updateStatus(message, type = 'info') {
  statusEl.innerHTML = `<p>${message}</p>`;
  
  const baseClasses = 'border rounded-lg p-4 text-center w-full mb-6';
  
  switch (type) {
    case 'ready':
      statusEl.className = `${baseClasses} bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200`;
      break;
    case 'error':
      statusEl.className = `${baseClasses} bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200`;
      break;
    default:
      statusEl.className = `${baseClasses} bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200`;
  }
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
    
    if (statusEl && infoEl) {
      updateStatus('✅ Screenshot captured successfully!', 'ready');
      updateInfo(`📁 Saved to: ${result.file_path}`);
      
      setTimeout(() => {
        updateStatus('🟢 Ready - Press ⌘⇧2 or use test button', 'ready');
        updateInfo('Press the global hotkey or use the test button above');
      }, 3000);
    }
    
  } catch (error) {
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
    updateStatus(`❌ Error opening preferences: ${error}`, 'error');
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  updateStatus('🔄 Registering global shortcuts...', 'info');
  
  try {
    let config;
    try {
      config = await invoke('get_config');
    } catch (error) {
      config = {
        capture_hotkey: 'Cmd+Shift+2',
        preferences_hotkey: 'Cmd+Comma'
      };
    }
    
    await register(config.capture_hotkey, captureScreenshot);
    await register(config.preferences_hotkey, openPreferences);
    
    updateStatus('🟢 Ready - Press ⌘⇧2 or use test button', 'ready');
    updateInfo('Global shortcuts are active! ⌘⇧2 for capture, ⌘, for preferences');
    
  } catch (error) {
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
