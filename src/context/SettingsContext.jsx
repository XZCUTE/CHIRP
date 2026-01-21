import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [showAntigravity, setShowAntigravity] = useState(() => {
    const saved = localStorage.getItem('capy_antigravity');
    return saved !== null ? JSON.parse(saved) : false; // Default to false
  });

  const [antigravityConfig, setAntigravityConfig] = useState(() => {
    const saved = localStorage.getItem('capy_antigravity_config');
    const defaultConfig = {
      count: 300,
      magnetRadius: 10,
      ringRadius: 10,
      waveSpeed: 0.4,
      waveAmplitude: 1,
      particleSize: 2,
      lerpSpeed: 0.1,
      color: '#ff9500',
      autoAnimate: true,
      particleVariance: 1,
      rotationSpeed: 0,
      depthFactor: 1,
      pulseSpeed: 3,
      particleShape: 'capsule',
      fieldStrength: 10,
    };
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  const toggleAntigravity = () => {
    setShowAntigravity(prev => {
      const newValue = !prev;
      localStorage.setItem('capy_antigravity', JSON.stringify(newValue));
      return newValue;
    });
  };

  const updateAntigravityConfig = (newConfig) => {
    setAntigravityConfig(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem('capy_antigravity_config', JSON.stringify(updated));
      return updated;
    });
  };

  // Sync settings across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'capy_antigravity') {
        if (e.newValue !== null) {
          setShowAntigravity(JSON.parse(e.newValue));
        }
      } else if (e.key === 'capy_antigravity_config') {
        if (e.newValue !== null) {
          setAntigravityConfig(prev => ({ ...prev, ...JSON.parse(e.newValue) }));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      showAntigravity, 
      toggleAntigravity,
      antigravityConfig,
      updateAntigravityConfig
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
