import React from 'react';

const Learn = () => {
  return (
    <div className="learn-page-container" style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <iframe 
        src="/learn/index.html" 
        title="Learn Cyber Security"
        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
        allowTransparency="true"
      />
    </div>
  );
};

export default Learn;
