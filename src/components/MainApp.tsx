import { useEffect, useState } from 'react';
import { Camera, Settings, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScreenshot } from '@/hooks/useScreenshot';
import { invoke } from '@/lib/tauri';

export function MainApp() {
  const { testScreenshot, isLoading } = useScreenshot();
  const [captureHotkey, setCaptureHotkey] = useState('⌘⇧2');

  const formatHotkey = (hotkey: string) =>
    hotkey
      .replace('CommandOrControl', '⌘')
      .replace('Shift', '⇧')
      .replace('Alt', '⌥')
      .replace('Ctrl', '⌃')
      .replace('Comma', ',')
      .replace('Period', '.')
      .replace(/\+/g, '');

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        const config = await invoke('get_config');
        if (isMounted) {
          setCaptureHotkey(formatHotkey(config.capture_hotkey));
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePreferences = async () => {
    try {
      await invoke('open_preferences');
    } catch (error) {
      console.error('Failed to open preferences:', error);
    }
  };

  const handleHideWindow = async () => {
    try {
      await invoke('hide_window');
    } catch (error) {
      console.error('Failed to hide window:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex flex-col items-center justify-center min-h-screen max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
            <Camera className="w-8 h-8" />
            Snipp
          </h1>
          <p className="text-lg text-muted-foreground">Screenshot Tool for macOS</p>
        </header>
        
        <section aria-live="polite" className="w-full mb-6">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center text-primary">
            <p>🔄 Ready to capture screenshots</p>
          </div>
        </section>

        <section className="w-full mb-6">
          <h2 className="text-xl font-semibold mb-3">How to use:</h2>
          <ol className="space-y-2 text-left">
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-primary/20 text-primary rounded-full text-sm font-semibold text-center mr-3 mt-0.5">1</span>
              Press <kbd className="bg-muted border border-border rounded px-2 py-1 text-sm font-mono">{captureHotkey}</kbd> anywhere on your system
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-primary/20 text-primary rounded-full text-sm font-semibold text-center mr-3 mt-0.5">2</span>
              Drag to select screenshot area
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-primary/20 text-primary rounded-full text-sm font-semibold text-center mr-3 mt-0.5">3</span>
              Screenshot will be saved to Desktop
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-primary/20 text-primary rounded-full text-sm font-semibold text-center mr-3 mt-0.5">4</span>
              Preview popup will appear for quick actions
            </li>
          </ol>
        </section>

        <section className="w-full mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={testScreenshot}
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
              <Camera className="w-4 h-4 mr-2" />
              Test Screenshot
            </Button>
            <Button 
              onClick={handlePreferences}
              variant="secondary"
              className="flex-1"
              size="lg"
            >
              <Settings className="w-4 h-4 mr-2" />
              Preferences
            </Button>
            <Button 
              onClick={handleHideWindow}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Window
            </Button>
          </div>
        </section>

        <footer className="w-full">
          <div className="bg-muted rounded-lg p-3 text-center text-sm text-muted-foreground">
            <p>Press the global hotkey or use the test button above</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
