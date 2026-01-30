import React, { useState, useEffect } from 'react';
import { searchApi } from '../utils/searchApi';
import InitialsAvatar from './InitialsAvatar';
import './UserSearchDropdown.css';

const UserSearchDropdown = ({ query, onSelect, position, allowedUsers }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!query) {
        setUsers([]);
        return;
      }
      setLoading(true);
      try {
        const result = await searchApi(query, 'users');
        const allUsers = result.users || [];
        
        // Filter users based on allowedUsers (friends)
        const filteredUsers = allowedUsers 
          ? allUsers.filter(u => allowedUsers[u.id]) 
          : allUsers;

        setUsers(filteredUsers);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [query, allowedUsers]);

  if (!query || (users.length === 0 && !loading)) return null;

  return (
    <div className="user-search-dropdown" style={{ 
      top: position?.top, 
      left: position?.left ?? 0,
      bottom: position?.bottom,
      position: 'absolute' 
    }}>
      {loading ? (
        <div className="dropdown-loading">Searching...</div>
      ) : (
        users.map(user => (
          <div key={user.id} className="dropdown-user-item" onClick={() => onSelect(user)}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="dropdown-avatar" />
            ) : (
              <InitialsAvatar name={user.name} uid={user.id} size={24} className="dropdown-avatar" />
            )}
            <div className="dropdown-user-info">
              <span className="dropdown-name">{user.name}</span>
              <span className="dropdown-username">@{user.username}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default UserSearchDropdown;
