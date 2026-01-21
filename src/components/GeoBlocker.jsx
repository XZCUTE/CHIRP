import React, { useState, useEffect, createContext, useContext } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const GeoContext = createContext();

export const useGeo = () => useContext(GeoContext);

const GeoBlocker = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);

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
      
      if (data.country_code === 'JP') {
        setIsAllowed(true);
      } else {
        setIsAllowed(false);
        // Force logout if not allowed
        if (auth.currentUser) {
          console.log("GeoBlocker: User outside Japan, forcing logout.");
          await signOut(auth);
        }
      }
    } catch (err) {
      console.error("Geo check failed:", err);
      setIsAllowed(false);
      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLocation();
    
    // Periodically check location (every 5 minutes) in case user changes IP/VPN
    const interval = setInterval(checkLocation, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GeoContext.Provider value={{ isAllowed, loading, checkLocation }}>
      {children}
    </GeoContext.Provider>
  );
};

export default GeoBlocker;
