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
      // 1. Check Cache first to avoid 429 errors
      const cachedStatus = sessionStorage.getItem('geo_allowed');
      const cacheTimestamp = sessionStorage.getItem('geo_timestamp');
      const now = Date.now();

      // If we checked in the last 10 minutes, use cache
      if (cachedStatus !== null && cacheTimestamp && (now - parseInt(cacheTimestamp) < 10 * 60 * 1000)) {
        const allowed = cachedStatus === 'true';
        setIsAllowed(allowed);
        if (!allowed && auth.currentUser) {
          await signOut(auth);
        }
        setLoading(false);
        return;
      }

      // 2. Fetch location data from ipwho.is (Better CORS support and higher limits)
      const response = await fetch('https://ipwho.is/');
      if (!response.ok) throw new Error("Failed to fetch location data");
      
      const data = await response.json();
      
      // Check if country is Japan (JP)
      const allowed = data.country_code === 'JP';
      setIsAllowed(allowed);
      
      // Update Cache
      sessionStorage.setItem('geo_allowed', allowed.toString());
      sessionStorage.setItem('geo_timestamp', now.toString());

      if (!allowed) {
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
