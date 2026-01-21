import React, { useState, useEffect, createContext, useContext } from 'react';

const GeoContext = createContext();

export const useGeo = () => useContext(GeoContext);

export const GeoProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState(null);

  const checkLocation = async () => {
    setLoading(true);
    setError(null);
    
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      setAllowed(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error("Connection Error");
      
      const data = await response.json();
      
      // Strictly Japan
      if (data.country_code === 'JP') {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch (err) {
      console.error("Geo check failed:", err);
      setAllowed(false);
      setError("Unable to establish secure connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLocation();
  }, []);

  return (
    <GeoContext.Provider value={{ allowed, loading, error, retry: checkLocation }}>
      {children}
    </GeoContext.Provider>
  );
};

// Keeping the component for backward compatibility if needed, but we'll use the Provider
const GeoBlocker = ({ children }) => {
  const { allowed, loading } = useGeo();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0f0f0f', 
        color: '#D2691E',
        fontFamily: 'monospace'
      }}>
        <h2>Initializing...</h2>
      </div>
    );
  }

  return children;
};

export default GeoBlocker;
