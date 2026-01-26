import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, remove, update } from 'firebase/database';
import { auth } from '../firebase';
import './PlayAdmin.css';

import { uploadToImgBB } from '../utils/imgbb';

const PlayAdmin = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  
  // Edit State
  const [editingGame, setEditingGame] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('user');
  const [editAuthor, setEditAuthor] = useState('');
  const [editVotes, setEditVotes] = useState(0);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check initial admin status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && (user.email === 'admin@chirp.com' || user.email.includes('dev'))) {
        setIsAdmin(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch games
  useEffect(() => {
    if (!isAuthenticated) return;

    const db = getDatabase();
    const gamesRef = ref(db, 'games');
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const gamesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse();
        setGames(gamesArray);
      } else {
        setGames([]);
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple hardcoded key for "secret" access as requested
    // In production this should be robust, but for this specific request:
    if (accessKey === 'capyadmin2026' || isAdmin) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid Access Key');
    }
  };

  const handleEditClick = (game) => {
    setEditingGame(game);
    setEditTitle(game.title || '');
    setEditDescription(game.description || '');
    setEditCategory(game.category || 'user');
    setEditAuthor(game.author || '');
    setEditVotes(game.votes || 0);
    setEditImagePreview(game.image || null);
    setEditImageFile(null);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateGame = async () => {
    if (!editingGame) return;
    
    setIsUpdating(true);
    const db = getDatabase();
    try {
      let imageUrl = editingGame.image;

      // Upload new image if selected
      if (editImageFile) {
          const imgData = await uploadToImgBB(editImageFile);
          imageUrl = imgData.url;
      }

      await update(ref(db, `games/${editingGame.id}`), {
        title: editTitle.toUpperCase(),
        description: editDescription,
        category: editCategory,
        author: editAuthor,
        votes: parseInt(editVotes) || 0,
        image: imageUrl
      });
      alert('Game updated successfully');
      setEditingGame(null);
    } catch (error) {
      console.error("Update failed:", error);
      alert("Update failed: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPlays = async (gameId) => {
      if (window.confirm("Reset plays to 0?")) {
        const db = getDatabase();
        try {
            await update(ref(db, `games/${gameId}`), {
                plays: 0
            });
        } catch (error) {
            console.error("Reset failed", error);
        }
      }
  };

  const handleDeleteGame = async (gameId, gameTitle) => {
    if (window.confirm(`Are you sure you want to delete "${gameTitle}"? This action cannot be undone.`)) {
      const db = getDatabase();
      try {
        await remove(ref(db, `games/${gameId}`));
        alert('Game deleted successfully');
      } catch (error) {
        console.error("Delete failed:", error);
        alert("Delete failed: " + error.message);
      }
    }
  };

  if (loading) return <div className="admin-loading">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-box">
          <h2>Admin Access</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Enter Access Key"
              className="admin-input"
            />
            <button type="submit" className="admin-btn">Enter</button>
          </form>
          <button onClick={() => navigate('/play')} className="back-link">Back to Arcade</button>
        </div>
      </div>
    );
  }

  return (
    <div className="play-admin-container">
      <header className="admin-header">
        <h1>Game Management</h1>
        <button onClick={() => navigate('/play')} className="exit-btn">Exit Admin</button>
      </header>

      <div className="games-list-container">
        <table className="games-table">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Title</th>
              <th>Author</th>
              <th>Category</th>
              <th>Voters</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map(game => (
              <tr key={game.id}>
                <td>
                  <img src={game.image} alt={game.title} className="admin-thumbnail" />
                </td>
                <td className="game-title-cell">{game.title}</td>
                <td>{game.author}</td>
                <td>
                  <span className={`status-badge ${game.category}`}>
                    {game.category}
                  </span>
                </td>
                <td>{game.votes || 0}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                        className="edit-btn"
                        onClick={() => handleEditClick(game)}
                    >
                        Edit
                    </button>
                    <button 
                        className="delete-btn"
                        onClick={() => handleDeleteGame(game.id, game.title)}
                    >
                        Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {games.length === 0 && (
              <tr>
                <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No games found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingGame && (
        <div className="admin-modal-overlay">
            <div className="admin-modal">
                <h3>Edit Game</h3>
                
                <div className="admin-form-group">
                    <label>Title</label>
                    <input 
                        type="text" 
                        value={editTitle} 
                        onChange={e => setEditTitle(e.target.value)} 
                        style={{textTransform: 'uppercase'}}
                    />
                </div>

                <div className="admin-form-group">
                    <label>Description</label>
                    <textarea 
                        value={editDescription} 
                        onChange={e => setEditDescription(e.target.value)}
                        rows="3"
                    />
                </div>

                <div className="admin-form-group">
                    <label>Category</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                        <option value="user">Community</option>
                        <option value="developer">Official</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="admin-form-group">
                    <label>Author</label>
                    <input 
                        type="text" 
                        value={editAuthor} 
                        onChange={e => setEditAuthor(e.target.value)} 
                    />
                </div>

                <div className="admin-form-group">
                    <label>Voters (Manual Edit)</label>
                    <input 
                        type="number" 
                        value={editVotes} 
                        onChange={e => setEditVotes(e.target.value)} 
                    />
                </div>

                <div className="admin-form-group">
                    <label>Cover Image</label>
                    <div className="plays-input-wrapper">
                         <button className="reset-btn" onClick={() => document.getElementById('edit-img-upload').click()}>
                            {editImagePreview ? 'Change Image' : 'Select Image'}
                         </button>
                         <input id="edit-img-upload" type="file" accept="image/*" onChange={handleImageSelect} hidden />
                    </div>
                    {editImagePreview && <img src={editImagePreview} alt="Preview" className="upload-preview" style={{height: '100px', width: 'auto', marginTop: '10px'}} />}
                </div>

                <div className="admin-modal-actions">
                    <button className="cancel-btn" onClick={() => setEditingGame(null)}>Cancel</button>
                    <button className="save-btn" onClick={handleUpdateGame} disabled={isUpdating}>
                        {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PlayAdmin;
