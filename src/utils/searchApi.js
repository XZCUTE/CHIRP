import { getDatabase, ref, get, query, orderByChild } from 'firebase/database';

/**
 * Simulates a backend search endpoint.
 * GET /api/search?q=<query>&type=all|users|posts
 * 
 * @param {string} q - The search query
 * @param {string} type - 'all', 'users', or 'posts'
 * @returns {Promise<{users: Array, posts: Array}>}
 */
export const searchApi = async (q, type = 'all') => {
  if (!q || !q.trim()) {
    return { users: [], posts: [] };
  }

  const db = getDatabase();
  const lowerQ = q.toLowerCase().trim();
  
  let users = [];
  let posts = [];

  try {
    // 1. Fetch Users if needed
    if (type === 'all' || type === 'users') {
      const usersRef = ref(db, 'users');
      // In a real backend, we would use a search index (Algolia/Elasticsearch).
      // For Firebase Realtime DB without external index, we fetch and filter.
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        users = Object.values(data).filter(user => {
          const name = (user.displayName || user.fullName || '').toLowerCase();
          const username = (user.username || '').toLowerCase(); // Assuming username exists, or we search email/name
          // Also search email prefix if needed? keeping it simple to name/username
          return name.includes(lowerQ) || username.includes(lowerQ);
        }).map(user => ({
          id: user.uid,
          name: user.displayName || user.fullName || 'Unknown Capy',
          username: user.username || user.email?.split('@')[0] || 'capy', // Fallback
          avatar: user.photoURL || null,
          role: user.role || 'User'
        }));
      }
    }

    // 2. Fetch Posts if needed
    if (type === 'all' || type === 'posts') {
      const postsRef = ref(db, 'posts');
      const snapshot = await get(postsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        posts = Object.entries(data).map(([key, post]) => ({
          id: key,
          ...post
        })).filter(post => {
          const content = (post.content || '').toLowerCase();
          const author = (post.author || '').toLowerCase();
          return content.includes(lowerQ) || author.includes(lowerQ);
        }).map(post => ({
          id: post.id,
          title: post.title || 'Untitled Post', // Posts might not have titles, mostly content
          content: post.content || '',
          image: post.image || null,
          images: post.images || null,
          linkPreview: post.linkPreview || null,
          timestamp: post.timestamp,
          author: {
            id: post.authorId,
            name: post.author || 'Anonymous',
            avatar: post.avatar || null
          }
        }));
        
        // Sort by newest
        posts.sort((a, b) => b.timestamp - a.timestamp);
      }
    }

    return { users, posts };

  } catch (error) {
    console.error("Search API Error:", error);
    throw error;
  }
};
