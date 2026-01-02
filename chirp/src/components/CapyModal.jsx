import React, { useEffect, useState } from 'react';
import './CapyModal.css';

const CapyModal = ({ isOpen, type, message, onConfirm, onClose, title }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 300); // Wait for animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show && !isOpen) return null;

  return (
    <div className={`capy-modal-overlay ${isOpen ? 'open' : 'closing'}`}>
      <div className={`capy-modal-content ${isOpen ? 'open' : 'closing'}`}>
        <div className="capy-modal-header">
          <span className="capy-modal-icon">
            {type === 'confirm' ? '❓' : '🦦'}
          </span>
          <h3 className="capy-modal-title">{title || (type === 'confirm' ? 'Confirm Action' : 'Capy Alert')}</h3>
        </div>
        
        <div className="capy-modal-body">
          <p>{message}</p>
        </div>

        <div className="capy-modal-actions">
          {type === 'confirm' ? (
            <>
              <button className="capy-modal-btn cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="capy-modal-btn confirm" onClick={onConfirm}>
                Yes, do it!
              </button>
            </>
          ) : (
            <button className="capy-modal-btn primary" onClick={onClose}>
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CapyModal;
