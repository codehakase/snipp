import { useEffect, useState, useCallback } from 'react';
import { Camera, EyeOff, Folder, Keyboard, Check, AlertCircle, X, Maximize, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri';
import type { AppConfig } from '@/types';

const formatHotkeyForDisplay = (hotkey: string): string => {
  return hotkey
    .replace(/CommandOrControl/g, '⌘')  // legacy / cross-platform
    .replace(/Super/g, '⌘')             // Command key (macOS)
    .replace(/Control/g, '⌃')
    .replace(/Ctrl/g, '⌃')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Comma/g, ',')
    .replace(/Period/g, '.')
    .replace(/\+/g, ' ');
};

const parseHotkeyFromDisplay = (displayHotkey: string): string => {
  return displayHotkey
    .replace(/⌘/g, 'Super')
    .replace(/⌃/g, 'Ctrl')
    .replace(/⇧/g, 'Shift')
    .replace(/⌥/g, 'Alt')
    .replace(/ /g, '+');
};

// Resolve the physical key (event.code) to a hotkey token, immune to Shift
// rewriting the character (the hyper chord always holds Shift, turning 1 -> "!").
// Restricted to the set the backend/plugin already handle.
const codeToKey = (code: string): string | null => {
  if (/^Key[A-Z]$/.test(code))  return code.slice(3);   // KeyX   -> X
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);   // Digit1 -> 1
  if (/^F\d{1,2}$/.test(code))   return code;            // F1..F12
  if (code === 'Comma')  return 'Comma';
  if (code === 'Period') return 'Period';
  return null;
};

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt']);

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

    // Canonical macOS order ⌃ ⌥ ⇧ ⌘; Ctrl and Cmd are kept separate so the
    // hyper chord (⌃⌥⇧⌘) is representable.
    const modifiers: string[] = [];
    if (event.ctrlKey)  modifiers.push('⌃');
    if (event.altKey)   modifiers.push('⌥');
    if (event.shiftKey) modifiers.push('⇧');
    if (event.metaKey)  modifiers.push('⌘');

    // Bare modifier press (incl. each key of the hyper chord): preview, keep waiting.
    if (MODIFIER_KEYS.has(event.key)) {
      setTempHotkey(modifiers.join(' '));
      return;
    }

    // Base key from the physical key (Shift-proof), require ≥1 modifier.
    const key = codeToKey(event.code);
    if (!key || modifiers.length === 0) {
      setTempHotkey(modifiers.join(' '));
      return;
    }

    const tauriHotkey = parseHotkeyFromDisplay([...modifiers, key].join(' '));
    if (editingShortcut === 'capture') {
      handleConfigChange({ capture_hotkey: tauriHotkey });
    }
    setEditingShortcut(null);
    setTempHotkey('');
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent rounded-md flex items-center justify-center">
              <Camera className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Snipp</h1>
              <p className="text-sm text-muted-foreground mt-1">Screenshot tool for macOS</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-md flex items-center gap-3">
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-sm text-accent">{successMessage}</span>
          </div>
        )}

        {/* Quick Actions Section */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Quick Actions</h2>
          
          <div className="space-y-2">
            <Button 
              onClick={handleCaptureArea}
              disabled={isLoading}
              className="w-full justify-between px-4 py-6 h-auto rounded-md bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
            >
              <div className="flex items-center gap-3 text-left">
                <Camera className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Capture Area</div>
                  <div className="text-xs opacity-75 mt-0.5">
                    Drag to select
                  </div>
                </div>
              </div>
              <kbd className="text-xs font-mono opacity-75">
                {formatHotkeyForDisplay(config.capture_hotkey)}
              </kbd>
            </Button>

            <Button 
              onClick={handleCaptureFull}
              disabled={isLoading}
              className="w-full justify-between px-4 py-6 h-auto rounded-md border border-border hover:bg-muted bg-transparent"
              variant="outline"
              size="lg"
            >
              <div className="flex items-center gap-3 text-left">
                <Maximize className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Capture Full Screen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Entire screen
                  </div>
                </div>
              </div>
            </Button>

            <Button 
              onClick={handleHideWindow}
              className="w-full justify-between px-4 py-6 h-auto rounded-md border border-border hover:bg-muted bg-transparent"
              variant="outline"
              size="lg"
            >
              <div className="flex items-center gap-3 text-left">
                <EyeOff className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Hide to Menubar</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Keep running in background
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </section>

        {/* Configuration Section */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Settings</h2>

          {/* Save Location */}
          <div className="mb-8">
            <label className="text-sm font-medium block mb-3">Save Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.default_save_location}
                readOnly
                className="flex-1 h-10 px-3 bg-muted border border-border rounded-md text-sm"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBrowseLocation}
                className="rounded-md bg-transparent"
              >
                <Folder className="w-4 h-4 mr-2" />
                Browse
              </Button>
            </div>
          </div>

          {/* Hotkeys */}
          <div className="mb-8">
            <label className="text-sm font-medium block mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Global Hotkeys
            </label>
            
            <div className="space-y-2">
              {/* Capture Hotkey */}
              <div className="flex items-center justify-between p-4 border border-border rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-sm">Capture Screenshot</span>
                {editingShortcut === 'capture' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-accent animate-pulse font-mono">
                      {tempHotkey || 'Press keys...'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={cancelEditingShortcut}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => startEditingShortcut('capture')}
                    className="font-mono text-sm h-8 px-2"
                  >
                    {formatHotkeyForDisplay(config.capture_hotkey)}
                    <Edit3 className="w-3 h-3 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Auto-copy Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={config.auto_copy_after_capture}
                onChange={(e) => handleConfigChange({ auto_copy_after_capture: e.target.checked })}
                className="w-4 h-4 accent-accent"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Auto-copy after capture</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Automatically copy to clipboard
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={config.auto_copy_after_edit}
                onChange={(e) => handleConfigChange({ auto_copy_after_edit: e.target.checked })}
                className="w-4 h-4 accent-accent"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Auto-copy after editing</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Copy edited screenshots automatically
                </div>
              </div>
            </label>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="mt-8 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-md bg-transparent"
                onClick={() => {
                  setConfig(originalConfig);
                  setHasChanges(false);
                }}
              >
                Reset
              </Button>
              <Button 
                className="flex-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground mb-4">
            Snipp runs in the menubar. Click the icon anytime to access.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs">
            <a 
              href="https://github.com/codehakase/snipp/issues/new?template=feature_request.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Suggest Feature
            </a>
            <a 
              href="https://github.com/codehakase/snipp/issues/new?template=bug_report.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Report Bug
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
