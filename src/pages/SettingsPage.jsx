import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import '../components/Cappies.css'; // Reuse existing styles

const SettingsPage = () => {
  const navigate = useNavigate();
  const { showAntigravity, toggleAntigravity, antigravityConfig, updateAntigravityConfig } = useSettings();

  const handleConfigChange = (key, value) => {
    updateAntigravityConfig({ [key]: value });
  };

  const menuItems = [
    { 
      label: 'CapyHome', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 
    },
    { 
      label: 'Connections', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
    },
    { 
      label: 'CapyDEVS', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> 
    },
    { 
      label: 'Reels', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg> 
    },
    { 
      label: 'Activities', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 
    },
    { 
      label: 'Learn', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg> 
    },
    { 
      label: 'Offers', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> 
    },
    { 
      label: 'Recruit', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> 
    },
    { 
      label: 'Crew', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
    },
    { 
      label: 'Play', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg> 
    },
    { 
      label: 'Settings', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.09a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.09a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> 
    },
  ];

  return (
    <div className="cappies-page-wrapper page-transition">
      <aside className="cappies-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Settings' ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Connections') navigate('/connections');
                else if (item.label === 'CapyDEVS') navigate('/devs');
                else if (item.label === 'Profile') navigate('/profile');
                else if (item.label === 'Settings') navigate('/settings');
                else if (item.label === 'Play') navigate('/play');
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>
      <div className="cappies-container">
        <div className="cappies-header">
          <div className="cappies-title" style={{ fontSize: '32px', marginBottom: '10px' }}>
            Settings
          </div>
          <div style={{ color: 'var(--capy-text-secondary)', marginBottom: '30px' }}>
            Customize your CHIRP experience
          </div>
        </div>

        <div className="cappies-content">
          <div style={{ 
            background: 'var(--capy-card-bg)', 
            border: '1px solid var(--capy-border)', 
            borderRadius: '16px', 
            padding: '24px' 
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--capy-border)', paddingBottom: '12px' }}>
              Visual Effects
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Background Antigravity</div>
                <div style={{ color: 'var(--capy-text-secondary)', fontSize: '14px' }}>
                  Enable the floating particle effect in the background
                </div>
              </div>
              
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                <input 
                  type="checkbox" 
                  checked={showAntigravity}
                  onChange={toggleAntigravity}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider round" style={{ 
                  position: 'absolute', 
                  cursor: 'pointer', 
                  top: 0, left: 0, right: 0, bottom: 0, 
                  backgroundColor: showAntigravity ? 'var(--capy-accent)' : '#ccc', 
                  transition: '.4s', 
                  borderRadius: '34px' 
                }}>
                  <span style={{ 
                    position: 'absolute', 
                    content: '""', 
                    height: '20px', 
                    width: '20px', 
                    left: showAntigravity ? '26px' : '4px', 
                    bottom: '4px', 
                    backgroundColor: 'white', 
                    transition: '.4s', 
                    borderRadius: '50%' 
                  }}></span>
                </span>
              </label>
            </div>

            {showAntigravity && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--capy-border)' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--capy-text)' }}>Effect Customization</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Left Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '14px' }}>Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="color" 
                          value={antigravityConfig.color}
                          onChange={(e) => handleConfigChange('color', e.target.value)}
                          style={{ border: 'none', width: '30px', height: '30px', cursor: 'pointer', background: 'transparent' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.color}</span>
                      </div>
                    </div>

                    {/* Particle Shape */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '14px' }}>Shape</label>
                      <select 
                        value={antigravityConfig.particleShape}
                        onChange={(e) => handleConfigChange('particleShape', e.target.value)}
                        style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          border: '1px solid var(--capy-border)', 
                          color: 'var(--capy-text)',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="capsule">Capsule</option>
                        <option value="circle">Circle</option>
                      </select>
                    </div>

                    {/* Count */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Count</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.count}</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" max="1000" step="10"
                        value={antigravityConfig.count}
                        onChange={(e) => handleConfigChange('count', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Magnet Radius */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Magnet Radius</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.magnetRadius}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" max="50" step="1"
                        value={antigravityConfig.magnetRadius}
                        onChange={(e) => handleConfigChange('magnetRadius', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Ring Radius */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Ring Radius</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.ringRadius}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" max="50" step="1"
                        value={antigravityConfig.ringRadius}
                        onChange={(e) => handleConfigChange('ringRadius', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Wave Speed */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Wave Speed</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.waveSpeed}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="2" step="0.1"
                        value={antigravityConfig.waveSpeed}
                        onChange={(e) => handleConfigChange('waveSpeed', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                     {/* Wave Amplitude */}
                     <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Wave Amplitude</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.waveAmplitude}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="5" step="0.1"
                        value={antigravityConfig.waveAmplitude}
                        onChange={(e) => handleConfigChange('waveAmplitude', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                  </div>

                  {/* Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Particle Size */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Particle Size</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.particleSize}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="5" step="0.1"
                        value={antigravityConfig.particleSize}
                        onChange={(e) => handleConfigChange('particleSize', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Lerp Speed */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Lerp Speed</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.lerpSpeed}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.01" max="1" step="0.01"
                        value={antigravityConfig.lerpSpeed}
                        onChange={(e) => handleConfigChange('lerpSpeed', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Particle Variance */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Variance</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.particleVariance}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={antigravityConfig.particleVariance}
                        onChange={(e) => handleConfigChange('particleVariance', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Rotation Speed */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Rotation Speed</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.rotationSpeed}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="5" step="0.1"
                        value={antigravityConfig.rotationSpeed}
                        onChange={(e) => handleConfigChange('rotationSpeed', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Depth Factor */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Depth Factor</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.depthFactor}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="5" step="0.1"
                        value={antigravityConfig.depthFactor}
                        onChange={(e) => handleConfigChange('depthFactor', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Pulse Speed */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Pulse Speed</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.pulseSpeed}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="5" step="0.1"
                        value={antigravityConfig.pulseSpeed}
                        onChange={(e) => handleConfigChange('pulseSpeed', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                    {/* Field Strength */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '14px' }}>Field Strength</label>
                        <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{antigravityConfig.fieldStrength}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" max="100" step="1"
                        value={antigravityConfig.fieldStrength}
                        onChange={(e) => handleConfigChange('fieldStrength', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--capy-accent)' }}
                      />
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
