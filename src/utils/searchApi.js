import { getDatabase, ref, get } from 'firebase/database';

/**
 * Simulates a backend search endpoint.
 * GET /api/search?q=<query>&type=all|users|posts|media|explore
 * 
 * @param {string} q - The search query
 * @param {string} type - 'all', 'users', 'posts', 'media', or 'explore'
 * @returns {Promise<{users: Array, posts: Array, media: Array}>}
 */
export const searchApi = async (q, type = 'all') => {
  if (!q || !q.trim()) {
    return { users: [], posts: [], media: [] };
  }

  const db = getDatabase();
  const lowerQ = q.toLowerCase().trim();
  const searchTerms = lowerQ.split(/\s+/); // Basic multi-word support
  
  // Helper for keyword matching
  const matches = (text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return searchTerms.every(term => lowerText.includes(term));
  };

  // Helper to extract YouTube ID
  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  let users = [];
  let posts = [];
  let media = [];

  try {
    const promises = [];

    // 1. Fetch Users
    if (type === 'all' || type === 'users') {
      promises.push(
        get(ref(db, 'users')).then(snapshot => {
          if (snapshot.exists()) {
            users = Object.values(snapshot.val()).filter(user => {
              const name = user.displayName || user.fullName || '';
              const username = user.username || '';
              return matches(name) || matches(username);
            }).map(user => ({
              id: user.uid,
              type: 'user',
              title: user.displayName || user.fullName || 'Unknown Capy',
              description: `@${user.username || user.email?.split('@')[0] || 'capy'}`,
              thumbnail: user.photoURL || null,
              route: `/profile/${user.uid}`,
              createdAt: user.createdAt || Date.now(), // Fallback
              author: null,
              data: user, // Keep original data if needed
              
              // Legacy fields for SearchPage.jsx compatibility
              name: user.displayName || user.fullName || 'Unknown Capy',
              username: user.username || user.email?.split('@')[0] || 'capy',
              avatar: user.photoURL || null
            }));
          }
        })
      );
    }

    // 2. Fetch Posts
    if (type === 'all' || type === 'posts') {
      promises.push(
        get(ref(db, 'posts')).then(snapshot => {
          if (snapshot.exists()) {
            posts = Object.entries(snapshot.val()).map(([key, post]) => ({
              id: key,
              ...post
            })).filter(post => {
              return matches(post.content) || matches(post.author);
            }).map(post => ({
              id: post.id,
              type: 'post',
              title: post.title || 'Post',
              description: post.content || '',
              thumbnail: post.image || (post.images ? post.images[0] : null) || (post.linkPreview ? post.linkPreview.image : null),
              route: `/post/${post.id}`, // Assuming individual post page exists
              createdAt: post.timestamp,
              author: {
                name: post.author || 'Anonymous',
                avatar: post.avatar || null,
                id: post.authorId // Ensure authorId is passed
              },
              data: post,

              // Legacy fields for SearchPage.jsx compatibility
              content: post.content || '',
              timestamp: post.timestamp,
              image: post.image || null,
              images: post.images || null,
              linkPreview: post.linkPreview || null
            })).sort((a, b) => b.createdAt - a.createdAt);
          }
        })
      );
    }

    // 3. Fetch Media (Games, Tips, Reels)
    if (type === 'all' || type === 'media' || type === 'explore') {
      // Games
      promises.push(
        get(ref(db, 'games')).then(snapshot => {
          if (snapshot.exists()) {
            const games = Object.entries(snapshot.val()).map(([key, game]) => ({
              id: key,
              ...game
            })).filter(game => {
              return matches(game.title) || matches(game.description) || matches(game.category);
            }).map(game => ({
              id: game.id,
              type: 'game',
              title: game.title,
              description: game.description,
              thumbnail: game.image, // Assuming 'image' field exists
              route: '/play', // Or specific game route if available
              createdAt: game.createdAt || Date.now(),
              author: {
                name: game.creator || 'Unknown Dev',
                avatar: null
              },
              tags: [game.category],
              data: game
            }));
            media = [...media, ...games];
          }
        })
      );

      // Tips
      promises.push(
        get(ref(db, 'tips')).then(snapshot => {
          if (snapshot.exists()) {
            const tips = Object.entries(snapshot.val()).map(([key, tip]) => ({
              id: key,
              ...tip
            })).filter(tip => {
              return matches(tip.content) || matches(tip.authorName);
            }).map(tip => ({
              id: tip.id,
              type: 'tip',
              title: `Tip by ${tip.authorName}`,
              description: tip.content,
              thumbnail: null, // Tips might not have images
              route: '/tips',
              createdAt: tip.createdAt,
              author: {
                name: tip.authorName,
                avatar: tip.authorAvatar
              },
              data: tip
            }));
            media = [...media, ...tips];
          }
        })
      );

      // Reels
      promises.push(
        get(ref(db, 'reels')).then(snapshot => {
          if (snapshot.exists()) {
            const reels = Object.entries(snapshot.val()).map(([key, reel]) => ({
              id: key,
              ...reel
            })).filter(reel => {
              return matches(reel.title) || matches(reel.description);
            }).map(reel => {
              const videoUrl = reel.originalUrl || reel.url;
              const ytId = getYoutubeId(videoUrl);
              const thumbnail = ytId 
                ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` 
                : videoUrl;
                
              return {
                id: reel.id,
                type: 'reel',
                title: reel.title || 'Reel',
                description: reel.description || '',
                thumbnail: thumbnail, 
                route: `/reels/${reel.id}`,
                createdAt: reel.timestamp,
                author: {
                  name: 'Unknown', 
                  avatar: null
                },
                data: reel,
                isYoutube: !!ytId
              };
            });
            media = [...media, ...reels];
          }
        })
      );
    }

    await Promise.all(promises);

    // Sort media by date
    media.sort((a, b) => b.createdAt - a.createdAt);

    return { users, posts, media };

  } catch (error) {
    console.error("Search API Error:", error);
    throw error;
  }
};
