import React, { useState, useEffect, createContext, useContext } from 'react';

const GeoContext = createContext();

export const useGeo = () => useContext(GeoContext);

const GeoBlocker = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true); // Default to true to not block initial render

  const checkLocation = async () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      setIsAllowed(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error("Failed to fetch location data");
      
      const data = await response.json();
      
      // Silently set allowed status
      if (data.country_code === 'JP') {
        setIsAllowed(true);
      } else {
        setIsAllowed(false);
      }
    } catch (err) {
      console.error("Geo check failed:", err);
      // Fail-closed: if we can't verify, we assume not allowed
      setIsAllowed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLocation();
  }, []);

  return (
    <GeoContext.Provider value={{ isAllowed, loading }}>
      {children}
    </GeoContext.Provider>
  );
};

export default GeoBlocker;
