import React, { useState, useEffect, useRef } from 'react';

const CustomCaptcha = ({ onValidate }) => {
  const canvasRef = useRef(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Generate random code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // Exclude similar looking chars like I, l, 1, O, 0
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserInput('');
    setIsValid(false);
    onValidate(false);
  };

  // Draw CAPTCHA on canvas
  const drawCaptcha = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background (Darker input match)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise (lines)
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(210, 105, 30, ${Math.random() * 0.5})`; // Theme color #D2691E
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Add noise (dots)
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`; 
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw Text
    ctx.font = 'bold 24px Courier New';
    ctx.textBaseline = 'middle';
    
    const codeLength = captchaCode.length;
    const charWidth = canvas.width / (codeLength + 1); // Distribute space

    for (let i = 0; i < codeLength; i++) {
      ctx.save();
      // Position
      const x = (i + 0.5) * charWidth + 10;
      const y = canvas.height / 2;
      
      // Random rotation and offset
      const angle = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2 radians
      const yOffset = (Math.random() - 0.5) * 5;

      ctx.translate(x, y + yOffset);
      ctx.rotate(angle);
      
      ctx.fillStyle = '#D2691E'; // Theme accent color
      ctx.fillText(captchaCode[i], 0, 0);
      ctx.restore();
    }
  };

  useEffect(() => {
    generateCode();
  }, []);

  useEffect(() => {
    drawCaptcha();
  }, [captchaCode]);

  const handleChange = (e) => {
    const input = e.target.value;
    setUserInput(input);
    if (input === captchaCode) {
      setIsValid(true);
      onValidate(true);
    } else {
      setIsValid(false);
      onValidate(false);
    }
  };

  return (
    <div className="custom-captcha-container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      width: '100%'
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <canvas 
          ref={canvasRef} 
          width="140" 
          height="50" 
          style={{ 
            borderRadius: '8px', 
            cursor: 'pointer',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onClick={generateCode}
          title="Click to refresh image"
        />
      </div>
      
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          type="text"
          placeholder="Enter code"
          value={userInput}
          onChange={handleChange}
          className="login-input"
          style={{
            textAlign: 'center',
            letterSpacing: '2px',
            padding: '14px',
            height: '50px' // Match canvas height
          }}
        />
        {isValid && <span style={{ 
          position: 'absolute', 
          right: '10px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: '#4caf50', 
          fontSize: '14px' 
        }}>✓</span>}
      </div>
    </div>
  );
};

export default CustomCaptcha;
