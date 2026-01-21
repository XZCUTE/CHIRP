import React, { useState, useEffect } from 'react';

const GeoBlocker = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [countryName, setCountryName] = useState('');

  const [error, setError] = useState(null);

  const checkLocation = async () => {
    setLoading(true);
    setError(null);
    
    // Bypass for localhost development so you don't lock yourself out while coding
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log("GeoBlocker: Localhost detected, bypassing check.");
      setAllowed(true);
      setLoading(false);
      return;
    }

    try {
      // Fetch location data from ipapi.co (Free tier: 1000 reqs/day)
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error("Failed to fetch location data");
      
      const data = await response.json();
      
      // Check if country is strictly Japan (JP)
      if (data.country_code === 'JP') {
        setAllowed(true);
      } else {
        setAllowed(false);
        setCountryName(data.country_name);
      }
    } catch (err) {
      console.error("GeoBlocker check failed:", err);
      // STRICT POLICY: If we can't verify the location, we block access.
      setAllowed(false);
      setError("Unable to verify your location. Access is restricted to Japan only.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLocation();
  }, []);

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
        <h2>Checking Region Availability...</h2>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0f0f0f', 
        color: '#ffffff',
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'monospace'
      }}>
        <h1 style={{ color: '#ff4d4d', fontSize: '3rem', marginBottom: '1rem' }}>⚠️ ACCESS DENIED</h1>
        
        <div style={{ border: '1px solid #ff4d4d', padding: '2rem', borderRadius: '8px', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}>
          <p style={{ fontSize: '1.4rem', maxWidth: '600px', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            This platform is <strong>exclusive to Japan</strong>.
          </p>
          
          {error ? (
            <>
              <p style={{ color: '#ff4d4d', marginBottom: '1rem' }}>{error}</p>
              <button 
                onClick={checkLocation}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#D2691E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Retry Location Verification
              </button>
            </>
          ) : (
            <p style={{ color: '#888', marginTop: '1rem' }}>
              Your detected location: <span style={{ color: '#ff4d4d' }}>{countryName || 'Outside Japan'}</span>
            </p>
          )}
        </div>
        
        <p style={{ marginTop: '2rem', color: '#555', fontSize: '0.8rem' }}>
          Security Policy: Regional Restriction [JP-ONLY]
        </p>
      </div>
    );
  }

  return children;
};

export default GeoBlocker;
