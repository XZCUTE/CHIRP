import { useEffect } from 'react';

const SecurityGuard = () => {
  useEffect(() => {
    // 1. Disable Right Click
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 2. Disable Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S)
    const handleKeyDown = (e) => {
      // Use e.code for better reliability (ignores CapsLock/Layout)
      // KeyU is the physical key 'U'
      if (
        e.code === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC')) ||
        (e.ctrlKey && e.code === 'KeyU') ||
        (e.ctrlKey && e.code === 'KeyS')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 3. DevTools Detection & Redirect
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        // Detected DevTools via window resize
        try {
            window.location.href = "about:blank";
        } catch(e) {
            // ignore
        }
      }
    };

    // 4. Anti-Debugging (Debugger Statement Loop)
    const antiDebug = () => {
      // This will pause execution if DevTools is open and breakpoints are active
      // or simply annoy the user if they try to step through code.
      // Wrapped in setInterval to constantly check.
      setInterval(() => {
        // Use a function constructor to obfuscate the debugger statement slightly
        try {
            (function(){return false;})['constructor']('debugger;').call();
        } catch(e) {
            // ignore
        }
      }, 1000);
    };

    // 5. Console clearing to hide logs
    const clearConsole = () => {
      setInterval(() => {
        try {
            console.clear();
        } catch(e) {
            // ignore
        }
      }, 2000);
    };

    // Attach Listeners with capture: true to intercept events early
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    // Start Detection Loops
    const devToolsInterval = setInterval(detectDevTools, 1000);
    antiDebug();
    clearConsole();

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      clearInterval(devToolsInterval);
    };
  }, []);

  return null; // This component renders nothing
};

export default SecurityGuard;
