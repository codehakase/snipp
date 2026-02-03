import { useEffect, useState, useCallback } from 'react';
import { Camera, Settings, EyeOff, Folder, Keyboard, Check, AlertCircle, X, Maximize, Edit3, Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri';
import type { AppConfig } from '@/types';

const formatHotkeyForDisplay = (hotkey: string): string => {
  return hotkey
    .replace('CommandOrControl', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace('Ctrl', '⌃')
    .replace('Comma', ',')
    .replace('Period', '.')
    .replace(/\+/g, ' ');
};

const parseHotkeyFromDisplay = (displayHotkey: string): string => {
  return displayHotkey
    .replace('⌘', 'CommandOrControl')
    .replace('⇧', 'Shift')
    .replace('⌥', 'Alt')
    .replace('⌃', 'Ctrl')
    .replace(/ /g, '+');
};

export function Dashboard() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<AppConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [tempHotkey, setTempHotkey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await invoke('get_config');
      setConfig(loadedConfig);
      setOriginalConfig(loadedConfig);
      setHasChanges(false);
    } catch (err) {
      setError('Failed to load configuration');
      console.error(err);
    }
  };

  const handleConfigChange = (updates: Partial<AppConfig>) => {
    if (!config || !originalConfig) return;
    
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(originalConfig));
    setError(null);
  };

  const handleSave = async () => {
    if (!config) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await invoke('update_config', { newConfig: config });
      setOriginalConfig(config);
      setHasChanges(false);
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to save settings. Please try again.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseLocation = async () => {
    try {
      const folder = await invoke('choose_save_location');
      if (folder) {
        handleConfigChange({ default_save_location: folder });
      }
    } catch (err) {
      console.error('Failed to choose save location:', err);
    }
  };

  const startEditingShortcut = (shortcutId: string) => {
    if (!config) return;
    setEditingShortcut(shortcutId);
    setTempHotkey('');
  };

  const cancelEditingShortcut = () => {
    setEditingShortcut(null);
    setTempHotkey('');
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!editingShortcut) return;
    
    event.preventDefault();
    
    if (event.key === 'Escape') {
      cancelEditingShortcut();
      return;
    }
    
    const keys: string[] = [];
    if (event.metaKey || event.ctrlKey) keys.push('⌘');
    if (event.shiftKey) keys.push('⇧');
    if (event.altKey) keys.push('⌥');
    
    // Add the main key (not modifier keys)
    if (event.key !== 'Meta' && event.key !== 'Control' && 
        event.key !== 'Shift' && event.key !== 'Alt' &&
        event.key !== 'Escape') {
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      keys.push(key);
    }
    
    if (keys.length >= 2) { // At least one modifier + one key
      const displayHotkey = keys.join(' ');
      const tauriHotkey = parseHotkeyFromDisplay(displayHotkey);
      
      // Update the appropriate config field
      if (editingShortcut === 'capture') {
        handleConfigChange({ capture_hotkey: tauriHotkey });
      } else if (editingShortcut === 'preferences') {
        handleConfigChange({ preferences_hotkey: tauriHotkey });
      }
      
      setEditingShortcut(null);
      setTempHotkey('');
    } else {
      setTempHotkey(keys.join(' '));
    }
  }, [editingShortcut, config]);

  useEffect(() => {
    if (editingShortcut) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingShortcut, handleKeyDown]);

  const handleCaptureArea = async () => {
    setIsLoading(true);
    try {
      await invoke('capture_screenshot');
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureFull = async () => {
    setIsLoading(true);
    try {
      await invoke('capture_full_screen');
    } catch (err) {
      console.error('Failed to capture full screen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHideWindow = async () => {
    try {
      await invoke('hide_window');
    } catch (err) {
      console.error('Failed to hide window:', err);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Snipp Dashboard</h1>
              <p className="text-sm text-muted-foreground">Screenshot Tool for macOS</p>
            </div>
          </div>
        </header>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <span className="text-sm">{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions Panel */}
          <section className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Quick Actions
            </h2>
            
            <div className="space-y-3">
              <Button 
                onClick={handleCaptureArea}
                disabled={isLoading}
                className="w-full justify-start"
                size="lg"
              >
                <Camera className="w-4 h-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Capture Area</div>
                  <div className="text-xs text-muted-foreground">
                    Drag to select screenshot area
                  </div>
                </div>
                <kbd className="ml-auto bg-muted px-2 py-1 rounded text-xs font-mono">
                  {formatHotkeyForDisplay(config.capture_hotkey)}
                </kbd>
              </Button>

              <Button 
                onClick={handleCaptureFull}
                disabled={isLoading}
                variant="secondary"
                className="w-full justify-start"
                size="lg"
              >
                <Maximize className="w-4 h-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Capture Full Screen</div>
                  <div className="text-xs text-muted-foreground">
                    Screenshot entire screen
                  </div>
                </div>
                <kbd className="ml-auto bg-muted px-2 py-1 rounded text-xs font-mono">
                  ⌘⇧F
                </kbd>
              </Button>

              <Button 
                onClick={handleHideWindow}
                variant="outline"
                className="w-full justify-start"
                size="lg"
              >
                <EyeOff className="w-4 h-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Hide to Menubar</div>
                  <div className="text-xs text-muted-foreground">
                    Keep running in background
                  </div>
                </div>
              </Button>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Use global hotkeys anytime, even when this window is hidden
              </p>
            </div>
          </section>

          {/* Configuration Panel */}
          <section className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configuration
            </h2>

            {/* Save Location */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Save Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.default_save_location}
                  readOnly
                  className="flex-1 h-10 px-3 bg-muted border rounded-md text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBrowseLocation}
                >
                  <Folder className="w-4 h-4 mr-2" />
                  Browse
                </Button>
              </div>
            </div>

            {/* Hotkeys */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Global Hotkeys
              </label>
              
              <div className="space-y-3">
                {/* Capture Hotkey */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Capture Screenshot</span>
                  {editingShortcut === 'capture' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary animate-pulse">
                        {tempHotkey || 'Press keys...'}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={cancelEditingShortcut}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => startEditingShortcut('capture')}
                      className="font-mono text-sm"
                    >
                      {formatHotkeyForDisplay(config.capture_hotkey)}
                      <Edit3 className="w-3 h-3 ml-2" />
                    </Button>
                  )}
                </div>

                {/* Preferences Hotkey */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Open Dashboard</span>
                  {editingShortcut === 'preferences' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary animate-pulse">
                        {tempHotkey || 'Press keys...'}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={cancelEditingShortcut}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => startEditingShortcut('preferences')}
                      className="font-mono text-sm"
                    >
                      {formatHotkeyForDisplay(config.preferences_hotkey)}
                      <Edit3 className="w-3 h-3 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Auto-copy Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors">
                <input
                  type="checkbox"
                  checked={config.auto_copy_after_capture}
                  onChange={(e) => handleConfigChange({ auto_copy_after_capture: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Auto-copy after capture</div>
                  <div className="text-xs text-muted-foreground">
                    Copy screenshots to clipboard automatically
                  </div>
                </div>
                <Copy className="w-4 h-4 text-muted-foreground" />
              </label>

              <label className="flex items-center gap-3 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors">
                <input
                  type="checkbox"
                  checked={config.auto_copy_after_edit}
                  onChange={(e) => handleConfigChange({ auto_copy_after_edit: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Auto-copy after editing</div>
                  <div className="text-xs text-muted-foreground">
                    Copy edited screenshots to clipboard
                  </div>
                </div>
                <Save className="w-4 h-4 text-muted-foreground" />
              </label>
            </div>

            {/* Save Button */}
            {hasChanges && (
              <div className="mt-6 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setConfig(originalConfig);
                    setHasChanges(false);
                  }}
                >
                  Reset
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Snipp runs in the menubar. Click the icon anytime to access.
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/codehakase/snipp/issues/new?template=feature_request.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Suggest Feature
              </a>
              <a 
                href="https://github.com/codehakase/snipp/issues/new?template=bug_report.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Report Bug
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
