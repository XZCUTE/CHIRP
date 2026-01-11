import React from 'react';

const InitialsAvatar = ({ name, uid, size = 40, fontSize, className = '' }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    // Remove emojis or special chars if needed, but simple charAt(0) is usually enough
    return name.trim().charAt(0).toUpperCase();
  };

  const getColor = (uid) => {
    if (!uid) return '#808080';
    // Simple hash function to get consistent color for same user
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFC300', 
      '#DAF7A6', '#581845', '#900C3F', '#C70039', '#FF5733',
      '#00CED1', '#FF4500', '#2E8B57', '#8A2BE2', '#D2691E'
    ];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div 
      className={`initials-avatar ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: getColor(uid),
        color: '#FFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize || `${size * 0.5}px`,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        userSelect: 'none',
        objectFit: 'cover' // To match img behavior if needed
      }}
    >
      {getInitials(name)}
    </div>
  );
};

export default InitialsAvatar;
