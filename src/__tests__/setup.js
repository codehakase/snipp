global.window = {
  __TAURI__: {
    core: {
      invoke: jest.fn()
    },
    globalShortcut: {
      register: jest.fn()
    },
    window: {
      getCurrentWindow: jest.fn(() => ({
        hide: jest.fn()
      }))
    }
  }
};

global.document = {
  getElementById: jest.fn(),
  addEventListener: jest.fn()
};

global.console = {
  log: jest.fn(),
  error: jest.fn()
};

global.setTimeout = jest.fn();