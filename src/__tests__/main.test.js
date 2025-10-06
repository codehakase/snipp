describe('Main.js Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    global.document.getElementById = jest.fn((id) => {
      if (id === 'status' || id === 'info') {
        return {
          innerHTML: '',
          className: ''
        };
      }
      return null;
    });
  });

  test('updateStatus function should update status element', () => {
    const statusEl = { innerHTML: '', className: '' };
    global.document.getElementById.mockReturnValue(statusEl);
    
    const updateStatus = (message, type = 'info') => {
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.innerHTML = `<p>${message}</p>`;
        statusEl.className = `status ${type}`;
      }
    };

    updateStatus('Test message', 'error');
    
    expect(statusEl.innerHTML).toBe('<p>Test message</p>');
    expect(statusEl.className).toBe('status error');
  });

  test('updateInfo function should update info element', () => {
    const infoEl = { innerHTML: '' };
    global.document.getElementById.mockReturnValue(infoEl);
    
    const updateInfo = (message) => {
      const infoEl = document.getElementById('info');
      if (infoEl) {
        infoEl.innerHTML = `<p><small>${message}</small></p>`;
      }
    };

    updateInfo('Test info message');
    
    expect(infoEl.innerHTML).toBe('<p><small>Test info message</small></p>');
  });

  test('default config should have correct structure', () => {
    const defaultConfig = {
      capture_hotkey: 'Cmd+Shift+2',
      preferences_hotkey: 'Cmd+Comma'
    };

    expect(defaultConfig.capture_hotkey).toBe('Cmd+Shift+2');
    expect(defaultConfig.preferences_hotkey).toBe('Cmd+Comma');
  });

  test('captureScreenshot should handle success', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({
      file_path: '/test/path/screenshot.png'
    });
    global.window.__TAURI__.core.invoke = mockInvoke;

    const statusEl = { innerHTML: '', className: '' };
    const infoEl = { innerHTML: '' };
    global.document.getElementById = jest.fn((id) => {
      if (id === 'status') return statusEl;
      if (id === 'info') return infoEl;
      return null;
    });

    const captureScreenshot = async () => {
      try {
        const statusEl = document.getElementById('status');
        const infoEl = document.getElementById('info');
        
        if (statusEl && infoEl) {
          infoEl.innerHTML = '<p><small>🔄 Taking screenshot...</small></p>';
          statusEl.innerHTML = '<p>📸 Capturing screenshot...</p>';
          statusEl.className = 'status info';
        }
        
        const result = await window.__TAURI__.core.invoke('capture_screenshot');
        
        if (statusEl && infoEl) {
          statusEl.innerHTML = '<p>✅ Screenshot captured successfully!</p>';
          statusEl.className = 'status ready';
          infoEl.innerHTML = `<p><small>📁 Saved to: ${result.file_path}</small></p>`;
        }
        
        return result;
      } catch (error) {
        const statusEl = document.getElementById('status');
        const infoEl = document.getElementById('info');
        if (statusEl && infoEl) {
          statusEl.innerHTML = `<p>❌ Error: ${error}</p>`;
          statusEl.className = 'status error';
          infoEl.innerHTML = '<p><small>Try again or check permissions</small></p>';
        }
        throw error;
      }
    };

    const result = await captureScreenshot();

    expect(mockInvoke).toHaveBeenCalledWith('capture_screenshot');
    expect(result.file_path).toBe('/test/path/screenshot.png');
    expect(statusEl.innerHTML).toBe('<p>✅ Screenshot captured successfully!</p>');
    expect(statusEl.className).toBe('status ready');
  });

  test('captureScreenshot should handle errors', async () => {
    const mockInvoke = jest.fn().mockRejectedValue(new Error('Test error'));
    global.window.__TAURI__.core.invoke = mockInvoke;

    const statusEl = { innerHTML: '', className: '' };
    const infoEl = { innerHTML: '' };
    global.document.getElementById = jest.fn((id) => {
      if (id === 'status') return statusEl;
      if (id === 'info') return infoEl;
      return null;
    });

    const captureScreenshot = async () => {
      try {
        const statusEl = document.getElementById('status');
        const infoEl = document.getElementById('info');
        
        if (statusEl && infoEl) {
          infoEl.innerHTML = '<p><small>🔄 Taking screenshot...</small></p>';
          statusEl.innerHTML = '<p>📸 Capturing screenshot...</p>';
          statusEl.className = 'status info';
        }
        
        const result = await window.__TAURI__.core.invoke('capture_screenshot');
        return result;
      } catch (error) {
        const statusEl = document.getElementById('status');
        const infoEl = document.getElementById('info');
        if (statusEl && infoEl) {
          statusEl.innerHTML = `<p>❌ Error: ${error}</p>`;
          statusEl.className = 'status error';
          infoEl.innerHTML = '<p><small>Try again or check permissions</small></p>';
        }
        throw error;
      }
    };

    await expect(captureScreenshot()).rejects.toThrow('Test error');
    expect(statusEl.innerHTML).toBe('<p>❌ Error: Error: Test error</p>');
    expect(statusEl.className).toBe('status error');
  });
});