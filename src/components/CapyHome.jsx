import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getDatabase, ref, onValue, push, update, remove, serverTimestamp, runTransaction, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import './CapyHome.css';
import CapyModal from './CapyModal';
import InitialsAvatar from './InitialsAvatar';
import MiniProfileCard from './MiniProfileCard';
import UserSearchDropdown from './UserSearchDropdown'; // New Import

// Helper to render mentions
const renderContentWithMentions = (text) => {
  if (!text) return null;
  // Regex to match @username (including underscores which replace spaces)
  // Supports @DisplayName_With_Spaces format
  const parts = text.split(/(@[\w._]+)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const handle = part.slice(1);
      // Revert underscores to spaces for display search
      return (
        <Link key={index} to={`/search?q=${handle.replace(/_/g, ' ')}&type=users`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--capy-accent)', textDecoration: 'none', fontWeight: 'bold' }}>
          {part.replace(/_/g, ' ')} 
        </Link>
      );
    }
    return part;
  });
};

import { uploadToImgBB, deleteFromImgBB } from '../utils/imgbb';

const CapyHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [newsIds, setNewsIds] = useState([]);
  const [newsLimit, setNewsLimit] = useState(3);
  const [scanIndex, setScanIndex] = useState(0); // For scanning HN IDs
  const [trends, setTrends] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('CapyHome');
  const [loadingNews, setLoadingNews] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); // { uid, x, y }

  const handleUserClick = (e, uid, initialName, initialAvatar) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate position relative to viewport
    // Default to showing on the right side
    setSelectedUser({
      uid,
      x: rect.right + 10, // Show to the right of the element
      y: rect.top, // Align with top of element
      initialName,
      initialAvatar
    });
  };
  const [trendTimeframe, setTrendTimeframe] = useState('daily');
  const [trendLimit, setTrendLimit] = useState(3);
  const [myFriends, setMyFriends] = useState({});
  const [postPrivacy, setPostPrivacy] = useState('world'); // world, cappies, self
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  
  // Saved Posts State
  const [savedPosts, setSavedPosts] = useState({});

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPost, setLightboxPost] = useState(null);

  const openLightbox = (images, index, post) => {
    // Normalize images to array of objects with url
    const normalizedImages = images.map(img => 
      typeof img === 'string' ? { url: img } : img
    );
    setLightboxImages(normalizedImages);
    setLightboxIndex(index);
    setLightboxPost(post);
    setLightboxOpen(true);
  };

  // Force update on profile change
  const [, forceUpdate] = useState();
  useEffect(() => {
    const handleProfileUpdate = () => forceUpdate({});
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);
  
  // Link Preview State
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [linkPreviewData, setLinkPreviewData] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Helper to extract URL
  const extractUrl = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text && text.match(urlRegex);
    return matches ? matches[0] : null;
  };

  // Generate Preview Effect
  useEffect(() => {
    if (!showLinkPreview) {
      setLinkPreviewData(null);
      return;
    }

    const url = extractUrl(newPostContent);
    if (!url) {
      // Don't clear preview here, as we might have just stripped the URL to hide it
      return;
    }

    setIsGeneratingPreview(true);
    let isMounted = true;

    const generatePreview = async () => {
      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch (e) {
        hostname = 'Unknown Source';
      }

      const updatePreview = (data) => {
        if (isMounted) {
          setLinkPreviewData(data);
          setIsGeneratingPreview(false);
          // Remove the URL from the content to hide it
          setNewPostContent(prev => prev.replace(url, '').trim());
        }
      };

      // 1. Check for Special Handlers (YouTube, Vimeo, Images)
      // Image Direct Link
      if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        updatePreview({
            url: url,
            title: 'Image Preview',
            description: 'Click to view full image',
            image: url,
            type: 'image',
            source: 'Image'
        });
        return;
      }

      // YouTube
      const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      if (ytMatch) {
        updatePreview({
            url: url,
            type: 'video',
            source: 'YouTube',
            videoId: ytMatch[1],
            title: 'YouTube Video', 
            description: 'Watch this video on Chirp',
            image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
            embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
        });
        return;
      }
      
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/([0-9]+)/);
      if (vimeoMatch) {
        updatePreview({
            url: url,
            type: 'video',
            source: 'Vimeo',
            videoId: vimeoMatch[1],
            title: 'Vimeo Video',
            description: 'Watch this video on Chirp',
            image: null, // Vimeo requires API for image, or let generic handler catch it if we want image
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
        });
        return;
      }

      // 2. Generic Sites - Fetch Metadata using Microlink API
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success') {
          const { title, description, image, logo, publisher } = result.data;
          
          updatePreview({
            url: url,
            title: title || hostname,
            description: description || `Visit ${hostname} to see more.`,
            image: image?.url || logo?.url || `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: publisher || hostname
          });
        } else {
            throw new Error('Microlink failed');
        }
      } catch (error) {
        console.warn("Link preview fetch failed, using fallback:", error);
        // Fallback to basic info
        updatePreview({
            url: url,
            title: hostname,
            description: `Visit ${hostname} to see more.`,
            image: `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: hostname
        });
      } finally {
        if (isMounted) {
          setIsGeneratingPreview(false);
        }
      }
    };

    // Debounce slightly to avoid rapid API calls
    const timer = setTimeout(() => {
        generatePreview();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newPostContent, showLinkPreview]);

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    message: '',
    onConfirm: null,
    title: ''
  });

  const showModal = ({ type = 'alert', message, onConfirm = null, title = '' }) => {
    setModalConfig({ isOpen: true, type, message, onConfirm, title });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };
  
  // Edit State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editNewImages, setEditNewImages] = useState([]);
  const [editNewPreviews, setEditNewPreviews] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsData, setCommentsData] = useState({}); // Map of postId -> comments array
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);

  // Mentions State
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionPosition, setMentionPosition] = useState(null);
  const [mentionTarget, setMentionTarget] = useState(null); // 'post', 'comment'
  const postInputRef = useRef(null);
  const commentInputRef = useRef(null);

  const handleInputMentions = (e, target) => {
    const { value, selectionStart } = e.target;
    
    // Check word before cursor
    const textBeforeCursor = value.slice(0, selectionStart);
    const words = textBeforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@') && currentWord.length > 1) {
      const query = currentWord.slice(1);
      setMentionQuery(query);
      setMentionTarget(target);
      
      // Calculate position relative to input container
      // This is simplified; ideally we calculate based on caret coordinates
      // For now, we'll position it below the input box
      if (target === 'post' && postInputRef.current) {
         // Position logic can be handled in CSS relative to parent, 
         // but passing null position lets the component handle default or fixed positioning
         // We'll pass a fixed offset or rely on absolute positioning in parent
         setMentionPosition({ top: '100%', left: 0 }); 
      } else {
         setMentionPosition(null); // Default handling
      }
    } else {
      setMentionQuery(null);
      setMentionTarget(null);
    }
    
    // Update actual state
    if (target === 'post') setNewPostContent(value);
    else if (target === 'comment') setCommentText(value);
  };

  const handleSelectMention = (user) => {
    // Use display name with spaces replaced by underscores for the handle
    const displayName = user.name || user.displayName || 'Unknown';
    const handle = `@${displayName.replace(/\s+/g, '_')}`;
    
    if (mentionTarget === 'post') {
       const textBeforeCursor = newPostContent.slice(0, newPostContent.lastIndexOf('@' + mentionQuery));
       // We need to be careful with replace, this is rough but works for simple cases at end of typing
       // Better: replace only the last occurrence of @query before cursor? 
       // For now, simple replace of the active query word
       const regex = new RegExp(`@${mentionQuery}$`);
       const newValue = newPostContent.replace(regex, handle + ' ');
       
       // Fallback if regex fails (e.g. cursor in middle)
       if (newValue === newPostContent) {
           // Try simple split/join on the last word
           const words = newPostContent.split(' ');
           words[words.length - 1] = handle;
           setNewPostContent(words.join(' ') + ' ');
       } else {
           setNewPostContent(newValue);
       }
    } else if (mentionTarget === 'comment') {
       const regex = new RegExp(`@${mentionQuery}$`);
       const newValue = commentText.replace(regex, handle + ' ');
        if (newValue === commentText) {
           const words = commentText.split(' ');
           words[words.length - 1] = handle;
           setCommentText(words.join(' ') + ' ');
       } else {
           setCommentText(newValue);
       }
    }
    
    setMentionQuery(null);
    setMentionTarget(null);
  };

  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;

  // Fetch Friends for Privacy and Validation
  useEffect(() => {
    if (!user) {
      setMyFriends({});
      return;
    }
    const friendsRef = ref(db, `users/${user.uid}/friends`);
    const unsubscribe = onValue(friendsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Fetch full profiles for friends to support name validation
        const friendsMap = {};
        const promises = Object.keys(data).map(async (friendUid) => {
            try {
                const userSnap = await get(ref(db, `users/${friendUid}`));
                if (userSnap.exists()) {
                    friendsMap[friendUid] = userSnap.val();
                } else {
                    friendsMap[friendUid] = { displayName: 'Unknown' };
                }
            } catch (e) {
                console.error("Error fetching friend profile:", e);
                friendsMap[friendUid] = { displayName: 'Unknown' };
            }
        });
        
        await Promise.all(promises);
        setMyFriends(friendsMap);
      } else {
        setMyFriends({});
      }
    });
    return () => unsubscribe();
  }, [user, db]);

  // Fetch Saved Posts
  useEffect(() => {
    if (!user) {
      setSavedPosts({});
      return;
    }
    const savedRef = ref(db, `users/${user.uid}/savedPosts`);
    const unsubscribe = onValue(savedRef, (snapshot) => {
      setSavedPosts(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [user, db]);

  // Helper: Check if story is tech/cyber related
  const isTechOrCyber = (story) => {
    if (!story || !story.title) return false;
    const text = (story.title + " " + (story.text || "")).toLowerCase();
    
    // Whitelist keywords
    const keywords = [
      'security', 'cyber', 'hack', 'breach', 'vulnerability', 'exploit', 'malware', 'ransomware', 'attack', 'phishing',
      'privacy', 'crypto', 'password', 'auth', 'botnet', 'spyware', 'linux', 'bug', 'patch', 'cve', 'zero-day',
      'firewall', 'network', 'protocol', 'encryption', 'token', 'ssh', 'ssl', 'tls', 'vpn', 'defense', 'threat',
      'virus', 'trojan', 'worm', 'rootkit', 'backdoor', 'xss', 'injection', 'overflow', 'ddos', 'mitm', 'arp', 'dns',
      'tech', 'software', 'developer', 'code', 'programming', 'ai', 'artificial intelligence', 'data', 'web', 'app',
      'system', 'computer', 'digital', 'internet', 'api', 'server', 'cloud', 'aws', 'azure', 'google', 'microsoft',
      'apple', 'linux', 'windows', 'macos', 'android', 'ios', 'mobile', 'device', 'hardware', 'firmware', 'chip',
      'processor', 'memory', 'storage', 'database', 'sql', 'nosql', 'algorithm', 'machine learning', 'neural',
      'browser', 'chrome', 'firefox', 'safari', 'edge', 'opensource', 'git', 'github', 'gitlab', 'framework', 'react',
      'node', 'python', 'java', 'rust', 'golang', 'c++', 'javascript', 'typescript'
    ];

    // Check if any keyword matches
    return keywords.some(kw => text.includes(kw));
  };

  // Fetch Hacker News
  useEffect(() => {
    const fetchNewsIds = async () => {
      try {
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = await response.json();
        setNewsIds(ids);
      } catch (error) {
        console.error("Error fetching HN IDs:", error);
        setLoadingNews(false);
      }
    };
    fetchNewsIds();
  }, []);

  // Filter and Load News
  useEffect(() => {
    if (newsIds.length === 0) return;
    if (news.length >= newsLimit) return; // Already have enough

    const fetchAndFilterNews = async () => {
      setLoadingNews(true);
      
      let currentNews = [...news];
      let currentIndex = scanIndex;
      let attempts = 0;
      const MAX_ATTEMPTS = 10; // Prevent infinite loops
      const BATCH_SIZE = 10;

      try {
        while (currentNews.length < newsLimit && currentIndex < newsIds.length && attempts < MAX_ATTEMPTS) {
          const idsToFetch = newsIds.slice(currentIndex, currentIndex + BATCH_SIZE);
          currentIndex += BATCH_SIZE;
          attempts++;

          const newsPromises = idsToFetch.map(id => 
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
          );
          
          const batchResults = await Promise.all(newsPromises);
          const validStories = batchResults.filter(story => story && story.type === 'story' && !story.dead && !story.deleted && isTechOrCyber(story));
          
          currentNews = [...currentNews, ...validStories];
        }

        setNews(currentNews);
        setScanIndex(currentIndex);
      } catch (error) {
        console.error("Error filtering HN details:", error);
      } finally {
        setLoadingNews(false);
      }
    };

    fetchAndFilterNews();
  }, [newsIds, newsLimit, news.length]); // Depend on news.length to trigger next batch if needed

  // Fetch Posts
  useEffect(() => {
    const postsRef = ref(db, 'posts');
    const unsubscribe = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => b.timestamp - a.timestamp);

        setPosts(postsArray);
      } else {
        setPosts([]);
        setTrends([]);
      }
    });

    return () => unsubscribe();
  }, [db]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.post-options-container') && 
          !event.target.closest('.comment-options-container') &&
          !event.target.closest('.privacy-selector-container')) {
        setOpenDropdownId(null);
        setOpenCommentDropdownId(null);
        setShowPrivacyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for comments when a post is expanded
  useEffect(() => {
    if (!activeCommentPostId) return;

    const commentsRef = ref(db, `posts/${activeCommentPostId}/comments_list`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedComments = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: loadedComments
        }));
      } else {
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: []
        }));
      }
    });

    return () => unsubscribe();
  }, [activeCommentPostId, db]);

  useEffect(() => {
    if (posts.length === 0) {
      setTrends([]);
      return;
    }
    calculateTrends(posts);
  }, [posts, trendTimeframe]);

  const calculateTrends = (currentPosts) => {
    const now = new Date();
    let start;

    if (trendTimeframe === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (trendTimeframe === 'weekly') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    } else if (trendTimeframe === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (trendTimeframe === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    let filteredPosts = currentPosts;

    if (start) {
      const startMs = start.getTime();
      filteredPosts = currentPosts.filter(post => {
        if (!post.timestamp) return false;

        let postTime;

        if (typeof post.timestamp === 'number') {
          postTime = post.timestamp;
        } else if (typeof post.timestamp === 'string') {
          const parsed = Date.parse(post.timestamp);
          if (Number.isNaN(parsed)) return false;
          postTime = parsed;
        } else if (post.timestamp && typeof post.timestamp.toMillis === 'function') {
          postTime = post.timestamp.toMillis();
        } else {
          return false;
        }

        return postTime >= startMs;
      });
    }

    const hashtagCounts = {};
    let totalHashtagsFound = 0;

    filteredPosts.forEach(post => {
      if (post.content) {
        const found = post.content.match(/#[a-zA-Z0-9_]+/g);
        if (found) {
          found.forEach(tag => {
            hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            totalHashtagsFound++;
          });
        }
      }
    });

    const sortedTrends = Object.entries(hashtagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setTrends(sortedTrends);
  };

  const handleTrendClick = (tag) => {
    if (selectedTrend === tag) {
      setSelectedTrend(null);
    } else {
      setSelectedTrend(tag);
      // Scroll to top of feed
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleVote = (postId, direction) => {
    if (!user) return showModal({ message: "Please login to vote!", title: "Login Required" });
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
      if (post) {
        if (!post.userVotes) post.userVotes = {};
        const currentVote = post.userVotes[user.uid] || 0;
        
        if (currentVote === direction) {
          // Toggle off
          post.score = (post.score || 0) - direction;
          post.userVotes[user.uid] = null;
        } else {
          // Switch vote or new vote
          post.score = (post.score || 0) - currentVote + direction;
          post.userVotes[user.uid] = direction;
        }
      }
      return post;
    });
  };

  const handleRepost = async (post) => {
    if (!user) return showModal({ message: "Please login to repost!", title: "Login Required" });
    
    // Determine source post (handle nested reposts)
    const sourcePost = post.repostData ? post.repostData : post;

    showModal({
      type: 'confirm',
      title: 'Repost Chirp',
      message: "Repost this chirp to your feed?",
      onConfirm: async () => {
        const postRef = ref(db, `posts/${post.id}/shares`);
        // Increment share count
        runTransaction(postRef, (current) => (current || 0) + 1);

        // Create new post
        try {
            const newPost = {
                content: '', // Empty content, using repostData
                author: user.displayName || 'Anonymous Capy',
                authorId: user.uid,
                avatar: user.photoURL || null,
                role: 'User',
                timestamp: serverTimestamp(),
                likes: 0,
                comments: 0,
                shares: 0,
                privacy: postPrivacy,
                repostOf: sourcePost.id || post.id,
                repostData: {
                    id: sourcePost.id || post.id,
                    author: sourcePost.author,
                    authorId: sourcePost.authorId,
                    avatar: sourcePost.avatar,
                    content: sourcePost.content,
                    image: sourcePost.image || null,
                    images: sourcePost.images || null,
                    linkPreview: sourcePost.linkPreview || null,
                    timestamp: sourcePost.timestamp
                }
            };
            
            await push(ref(db, 'posts'), newPost);
            closeModal();
        } catch (e) {
            console.error("Repost failed", e);
        }
      }
    });
  };

  const toggleComments = (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
    }
  };

  const handleSubmitComment = async (postId) => {
    if (!commentText.trim()) return;
    if (!user) return showModal({ message: "Please login to comment!", title: "Login Required" });

    // Validate Mentions (Cappies Only)
    const mentions = commentText.match(/@[\w._]+/g);
    if (mentions) {
        for (const mention of mentions) {
            const handle = mention.slice(1);
            const potentialName = handle.replace(/_/g, ' ').toLowerCase();
            const isFriend = Object.values(myFriends).some(friend => {
                const friendName = (friend.displayName || friend.name || '').toLowerCase();
                const friendHandle = friendName.replace(/\s+/g, '_');
                return friendName === potentialName || friendHandle === handle.toLowerCase();
            });

            if (!isFriend) {
                showModal({ message: `You can only mention your Cappies. "@${handle.replace(/_/g, ' ')}" is not in your connections.`, title: "Mention Error" });
                return;
            }
        }
    }

    try {
      // Add comment to subcollection
      await push(ref(db, `posts/${postId}/comments_list`), {
        text: commentText,
        author: user.displayName || 'Anonymous Capy',
        authorId: user.uid,
        avatar: user.photoURL || null,
        timestamp: serverTimestamp()
      });

      // Update comment count
      runTransaction(ref(db, `posts/${postId}`), (post) => {
        if (post) {
          post.comments = (post.comments || 0) + 1;
        }
        return post;
      });

      setCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const processFiles = (files) => {
    const validFiles = [];
    const validPreviews = [];
    let hasError = false;

    files.forEach(file => {
      // Validate file type
      if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
        if (!hasError) showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
        hasError = true;
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        if (!hasError) showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
        hasError = true;
        return;
      }
      
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      setImagePreviews(prev => [...prev, ...validPreviews]);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    processFiles(files);
    e.target.value = null;
  };

  const removeSelectedImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      const files = [];
      let hasImage = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImage = true;
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }

      if (hasImage) {
        e.preventDefault();
        if (files.length > 0) {
          processFiles(files);
        }
      }
    }
  };

  const handlePostSubmit = async () => {
    if (!newPostContent.trim() && selectedImages.length === 0) return;

    // Validate Mentions (Cappies Only)
    const mentions = newPostContent.match(/@[\w._]+/g);
    if (mentions) {
        for (const mention of mentions) {
            const handle = mention.slice(1); // Remove @
            // NOTE: Ideally we check against user IDs, but we only have handles here.
            // Since we constrained the dropdown to myFriends, valid selection is safe.
            // But manual typing needs verification.
            // For rigorous verification, we would need to map handles back to IDs or
            // check if a friend exists with that display name (normalized).
            
            // Normalize handle back to display name format (underscores to spaces)
            const potentialName = handle.replace(/_/g, ' ').toLowerCase();
            
            // Check if any friend matches this name (case insensitive)
            const isFriend = Object.values(myFriends).some(friend => {
                const friendName = (friend.displayName || friend.name || '').toLowerCase();
                const friendHandle = friendName.replace(/\s+/g, '_');
                return friendName === potentialName || friendHandle === handle.toLowerCase();
            });

            if (!isFriend) {
                showModal({ message: `You can only mention your Cappies. "@${handle.replace(/_/g, ' ')}" is not in your connections.`, title: "Mention Error" });
                return;
            }
        }
    }
    
    setIsUploading(true);
    try {
      const uploadedImages = [];

      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(image => uploadToImgBB(image));
        const results = await Promise.all(uploadPromises);
        
        results.forEach(result => {
           uploadedImages.push({
             url: result.url,
             deleteUrl: result.deleteUrl
           });
        });
      }

      const newPost = {
        content: newPostContent,
        author: user?.displayName || 'Anonymous Capy',
        authorId: user?.uid,
        avatar: user?.photoURL || null,
        role: 'User', // Default role
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        shares: 0,
        privacy: postPrivacy,
        images: uploadedImages.length > 0 ? uploadedImages : null,
        image: uploadedImages.length > 0 ? uploadedImages[0].url : null,
        imageDeleteUrl: uploadedImages.length > 0 ? uploadedImages[0].deleteUrl : null
      };

      if (showLinkPreview && linkPreviewData) {
        newPost.linkPreview = linkPreviewData;
        
        // Remove the URL from the content text so it's not duplicated
        // We escape the URL string to safely use it in regex
        const escapedUrl = linkPreviewData.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const urlRegex = new RegExp(escapedUrl, 'g');
        newPost.content = newPost.content.replace(urlRegex, '').trim();
      }

      await push(ref(db, 'posts'), newPost);
      setNewPostContent('');
      setShowLinkPreview(false);
      setLinkPreviewData(null);
      setSelectedImages([]);
      setImagePreviews([]);
    } catch (error) {
      console.error("Error creating post:", error);
      showModal({ message: "Failed to create post. Please try again.", title: "Error" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePost = async (postId) => {
    if (!user) return showModal({ message: "Please login to save posts!", title: "Login Required" });
    
    const isSaved = savedPosts[postId];
    const updates = {};
    if (isSaved) {
      updates[`users/${user.uid}/savedPosts/${postId}`] = null;
    } else {
      updates[`users/${user.uid}/savedPosts/${postId}`] = true;
    }
    
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error("Error toggling save:", error);
      showModal({ message: "Failed to save/unsave post.", title: "Error" });
    }
  };

  const handleEditImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = [];
    const validPreviews = [];
    let hasError = false;

    files.forEach(file => {
      if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
        if (!hasError) showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
        hasError = true;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (!hasError) showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
        hasError = true;
        return;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });

    if (validFiles.length > 0) {
      setEditNewImages(prev => [...prev, ...validFiles]);
      setEditNewPreviews(prev => [...prev, ...validPreviews]);
    }
    e.target.value = null;
  };

  const removeEditNewImage = (index) => {
    setEditNewImages(prev => prev.filter((_, i) => i !== index));
    setEditNewPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeEditExistingImage = (index) => {
    setEditExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditPaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      const files = [];
      let hasImage = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImage = true;
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }

      if (hasImage) {
        e.preventDefault();
        if (files.length > 0) {
          const validFiles = [];
          const validPreviews = [];
          let hasError = false;

          files.forEach(file => {
            if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
              if (!hasError) showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
              hasError = true;
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              if (!hasError) showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
              hasError = true;
              return;
            }
            validFiles.push(file);
            validPreviews.push(URL.createObjectURL(file));
          });

          if (validFiles.length > 0) {
            setEditNewImages(prev => [...prev, ...validFiles]);
            setEditNewPreviews(prev => [...prev, ...validPreviews]);
          }
        }
      }
    }
  };

  const handleEditClick = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    
    let existing = [];
    if (post.images) {
      existing = post.images;
    } else if (post.image) {
      existing = [{ url: post.image, deleteUrl: post.imageDeleteUrl }];
    }
    setEditExistingImages(existing);
    setEditNewImages([]);
    setEditNewPreviews([]);

    setOpenDropdownId(null);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim() && editExistingImages.length === 0 && editNewImages.length === 0) return;
    
    try {
      let uploadedNewImages = [];
      if (editNewImages.length > 0) {
         const uploadPromises = editNewImages.map(image => uploadToImgBB(image));
         const results = await Promise.all(uploadPromises);
         results.forEach(result => {
           uploadedNewImages.push({
             url: result.url,
             deleteUrl: result.deleteUrl
           });
         });
      }

      const finalImages = [...editExistingImages, ...uploadedNewImages];

      await update(ref(db, `posts/${postId}`), {
        content: editContent,
        isEdited: true,
        images: finalImages.length > 0 ? finalImages : null,
        image: finalImages.length > 0 ? finalImages[0].url : null,
        imageDeleteUrl: finalImages.length > 0 ? finalImages[0].deleteUrl : null
      });

      setEditingPostId(null);
      setEditContent('');
      setEditExistingImages([]);
      setEditNewImages([]);
      setEditNewPreviews([]);
    } catch (error) {
      console.error("Error updating post:", error);
      showModal({ message: "Failed to update post.", title: "Error" });
    }
  };

  const handleDeleteClick = (post) => {
    setOpenDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Chirp',
      message: "Are you sure you want to delete this post?",
      onConfirm: async () => {
        try {
          // Delete images from ImgBB if they exist
          if (post.images) {
            // Delete all images (best effort)
            await Promise.all(post.images.map(img => 
              img.deleteUrl ? deleteFromImgBB(img.deleteUrl) : Promise.resolve()
            ));
          } else if (post.imageDeleteUrl) {
            await deleteFromImgBB(post.imageDeleteUrl);
          }

          await remove(ref(db, `posts/${post.id}`));
          
          // Decrement share count if it's a repost
          if (post.repostOf) {
            const sharesRef = ref(db, `posts/${post.repostOf}/shares`);
            runTransaction(sharesRef, (current) => {
              return (current && current > 0) ? current - 1 : 0;
            });
          }

          closeModal();
        } catch (error) {
          console.error("Error deleting post:", error);
          showModal({ message: "Failed to delete post.", title: "Error" });
        }
      }
    });
  };

  // Comment Actions
  const handleEditCommentClick = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setOpenCommentDropdownId(null);
  };

  const handleSaveEditComment = async (postId, commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await update(ref(db, `posts/${postId}/comments_list/${commentId}`), {
        text: editCommentText,
        isEdited: true
      });
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error("Error updating comment:", error);
      showModal({ message: "Failed to update comment.", title: "Error" });
    }
  };

  const handleDeleteCommentClick = (postId, commentId) => {
    setOpenCommentDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Comment',
      message: "Are you sure you want to delete this comment?",
      onConfirm: async () => {
        try {
          await remove(ref(db, `posts/${postId}/comments_list/${commentId}`));
          // Update comment count
          runTransaction(ref(db, `posts/${postId}`), (post) => {
            if (post && post.comments > 0) {
              post.comments--;
            }
            return post;
          });
          closeModal();
        } catch (error) {
          console.error("Error deleting comment:", error);
          showModal({ message: "Failed to delete comment.", title: "Error" });
        }
      }
    });
  };

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
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
      label: 'CapyTips', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> 
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
      label: 'CHIRPY', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> 
    },
    { 
      label: 'Squads', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
    },
    { 
      label: 'Play', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg> 
    },
    { 
      label: 'Settings', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 
    },
  ];

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min. ago`;
    if (hours < 24) return `${hours} hr. ago`;
    return `${days} days ago`;
  };

  const displayedPosts = posts.filter(post => {
    // 1. Filter by Trend
    if (selectedTrend && (!post.content || !post.content.includes(selectedTrend))) return false;

    // 2. Filter by Privacy
    if (!post.privacy || post.privacy === 'world') return true; // Public
    
    // If private/friends, must be logged in to potentially see it
    if (!user) return false;
    
    // I can always see my own posts
    if (post.authorId === user.uid) return true;

    // Self only
    if (post.privacy === 'self') return false;

    // Cappies (Friends) only
    if (post.privacy === 'cappies') {
      // Visible if author is in my friends list
      return myFriends[post.authorId];
    }

    return true;
  }).sort((a, b) => {
    if (selectedTrend) {
      return (b.score || 0) - (a.score || 0);
    }
    return 0; // Already sorted by timestamp in fetch
  });

  return (
    <div className="capy-home-container page-transition">
      {/* Left Sidebar */}
      <aside className="home-sidebar left-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.label);
                if (item.label === 'CapyHome') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (item.label === 'Connections') {
                  navigate('/connections');
                } else if (item.label === 'CapyDEVS') {
                  navigate('/devs');
                } else if (item.label === 'CapyTips') {
                  navigate('/tips');
                } else if (item.label === 'Profile') {
                  navigate('/profile');
                } else if (item.label === 'Settings') {
                  navigate('/settings');
                } else if (item.label === 'Reels') {
                  navigate('/reels');
                } else if (item.label === 'Activities') {
                  navigate('/activities');
                } else if (item.label === 'Learn') {
                  navigate('/learn');
                } else if (item.label === 'Offers') {
                  navigate('/offers');
                } else if (item.label === 'CHIRPY') {
                  navigate('/chirpy');
                } else if (item.label === 'Squads') {
                  navigate('/squads');
                } else if (item.label === 'Play') {
                  navigate('/play');
                }
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Center Feed */}
      <main className="home-feed">
        {/* Create Post Input */}
        <div className="create-post-card capy-card">
          <div className="create-post-top">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Me" 
                className="user-avatar-small" 
              />
            ) : (
              <InitialsAvatar 
                name={user?.displayName || user?.email} 
                uid={user?.uid} 
                className="user-avatar-small"
                size={40}
                fontSize="16px"
              />
            )}
            <div style={{ position: 'relative' }}>
              <input 
                type="text"  
                placeholder="What's on your mind, Capy? Use #hashtags to trend!" 
                className="create-post-input"
                value={newPostContent}
                onChange={(e) => {
                    setNewPostContent(e.target.value);
                    handleInputMentions(e, 'post');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePostSubmit()}
                onPaste={handlePaste}
                ref={postInputRef}
              />
              {mentionTarget === 'post' && (
                <UserSearchDropdown 
                   query={mentionQuery}
                   onSelect={handleSelectMention}
                   position={mentionPosition}
                   allowedUsers={myFriends}
                />
              )}
            </div>
          </div>

          {/* Image Preview Area */}
          {imagePreviews.length > 0 && (
            <div className="image-preview-grid">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="image-preview-item">
                  <img src={preview} alt={`Preview ${index}`} className="image-preview-img" />
                  <button 
                    className="remove-image-btn" 
                    onClick={() => removeSelectedImage(index)}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Link Preview Area */}
          {showLinkPreview && (
            <div className="link-preview-area">
              {isGeneratingPreview ? (
                 <div className="preview-skeleton">
                   <div className="skeleton-line"></div>
                   <div className="skeleton-line short"></div>
                 </div>
              ) : linkPreviewData ? (
                <div className="preview-card-mini">
                  {linkPreviewData.image && <img src={linkPreviewData.image} alt="Preview" className="preview-img-mini" />}
                  <div className="preview-info-mini">
                    <span className="preview-title-mini">{linkPreviewData.title}</span>
                    <span className="preview-source-mini">{linkPreviewData.source}</span>
                  </div>
                </div>
              ) : (
                <div className="preview-placeholder">
                  Type a URL to generate a preview...
                </div>
              )}
            </div>
          )}

          <div className="create-post-actions">
            <div className="privacy-selector-container">
              <button 
                className="privacy-btn" 
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                title="Post Privacy"
              >
                {postPrivacy === 'world' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    World
                  </>
                )}
                {postPrivacy === 'cappies' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Connections
                  </>
                )}
                {postPrivacy === 'self' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Self
                  </>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-arrow-icon">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {showPrivacyMenu && (
                <div className="privacy-menu">
                  <button onClick={() => { setPostPrivacy('world'); setShowPrivacyMenu(false); }} className={postPrivacy === 'world' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    World (Public)
                  </button>
                  <button onClick={() => { setPostPrivacy('cappies'); setShowPrivacyMenu(false); }} className={postPrivacy === 'cappies' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Connections
                  </button>
                  <button onClick={() => { setPostPrivacy('self'); setShowPrivacyMenu(false); }} className={postPrivacy === 'self' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Self (Private)
                  </button>
                </div>
              )}
            </div>

            <button 
              className={`post-action-btn ${showLinkPreview ? 'active' : ''}`}
              onClick={() => setShowLinkPreview(!showLinkPreview)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Web Link
            </button>
            <input 
              type="file" 
              id="image-upload" 
              accept="image/*" 
              multiple
              style={{ display: 'none' }} 
              onChange={handleImageSelect}
            />
            <button 
              className={`post-action-btn ${selectedImages.length > 0 ? 'active' : ''}`}
              onClick={() => document.getElementById('image-upload').click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Photo/GIF
            </button>
            <button 
              className="post-action-btn post-submit-btn" 
              onClick={handlePostSubmit} 
              disabled={isUploading}
            >
              {isUploading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Active Trend Banner */}
        {selectedTrend && (
          <div className="active-trend-banner">
             <div className="trend-info">
               <span className="trend-label">Trending Now</span>
               <h2 className="trend-tag">{selectedTrend}</h2>
             </div>
             <button className="clear-trend-btn" onClick={() => setSelectedTrend(null)}>
               Show All Posts
             </button>
          </div>
        )}

        {/* Real Posts */}
        {displayedPosts.length === 0 ? (
          <div className="no-posts" style={{ textAlign: 'center', padding: '20px', color: 'var(--capy-text-secondary)' }}>
            {selectedTrend ? `No posts found for ${selectedTrend}` : 'No posts yet. Be the first to chirp!'}
          </div>
        ) : (
          displayedPosts.map((post, index) => (
            <div 
              key={post.id} 
              className="post-card capy-card"
              style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s backwards` }}
            >
              <div className="post-header">
                <div className="post-avatar-wrapper" onClick={(e) => handleUserClick(e, post.authorId, post.author, post.avatar)} style={{cursor: 'pointer'}}>
                  {((user && post.authorId === user.uid && user.photoURL) || (post.authorId !== user?.uid && post.avatar && !post.avatar.includes('dicebear'))) ? (
                    <img 
                      src={(user && post.authorId === user.uid) ? user.photoURL : post.avatar} 
                      alt={post.author} 
                      className="post-avatar" 
                    />
                  ) : (
                    <InitialsAvatar 
                      name={post.author} 
                      uid={post.authorId} 
                      className="post-avatar"
                      size={44}
                    />
                  )}
                </div>
                <div className="post-info">
                  <span className="post-author" onClick={(e) => handleUserClick(e, post.authorId, post.author, post.avatar)} style={{cursor: 'pointer'}}>{post.author}</span>
                  <span className="post-separator">•</span>
                  <span className="post-time">
                    {getRelativeTime(post.timestamp)}
                    {post.privacy === 'cappies' && <span title="Friends Only" style={{marginLeft: '4px'}}>🐾</span>}
                    {post.privacy === 'self' && <span title="Private" style={{marginLeft: '4px'}}>🔒</span>}
                    {post.isEdited && <span className="edited-label"> - edited</span>}
                  </span>
                </div>
                
                {/* Options Menu - Only for Author */}
                {user && user.uid === post.authorId && (
                  <div className="post-options-container">
                    <button 
                      className="post-options" 
                      onClick={() => toggleDropdown(post.id)}
                    >
                      •••
                    </button>
                    {openDropdownId === post.id && (
                      <div className="options-dropdown">
                        <button onClick={() => handleEditClick(post)}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(post)} className="delete-option">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="post-content">
                {editingPostId === post.id ? (
                  <div className="edit-post-form">
                    <textarea 
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onPaste={handleEditPaste}
                      className="edit-post-textarea"
                    />
                    
                    {/* Edit Images Area */}
                    <div className="edit-images-area" style={{ marginTop: '10px' }}>
                      {/* Existing Images */}
                      {editExistingImages.length > 0 && (
                          <div className="image-preview-grid" style={{ marginBottom: '10px' }}>
                              {editExistingImages.map((img, index) => (
                                  <div key={`existing-${index}`} className="image-preview-item">
                                      <img src={img.url} alt={`Existing ${index}`} className="image-preview-img" />
                                      <button 
                                          className="remove-image-btn" 
                                          onClick={() => removeEditExistingImage(index)}
                                      >×</button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* New Images */}
                      {editNewPreviews.length > 0 && (
                          <div className="image-preview-grid" style={{ marginBottom: '10px' }}>
                              {editNewPreviews.map((preview, index) => (
                                  <div key={`new-${index}`} className="image-preview-item">
                                      <img src={preview} alt={`New ${index}`} className="image-preview-img" />
                                      <button 
                                          className="remove-image-btn" 
                                          onClick={() => removeEditNewImage(index)}
                                      >×</button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Add Image Button */}
                      <input 
                          type="file" 
                          id={`edit-image-upload-${post.id}`} 
                          accept="image/*" 
                          multiple
                          style={{ display: 'none' }} 
                          onChange={handleEditImageSelect}
                      />
                      <button 
                          className="post-action-btn" 
                          style={{ width: 'auto', padding: '5px 10px', fontSize: '0.9rem' }}
                          onClick={() => document.getElementById(`edit-image-upload-${post.id}`).click()}
                      >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                          Add Photo
                      </button>
                    </div>

                    <div className="edit-actions">
                      <button onClick={() => setEditingPostId(null)} className="cancel-btn">Cancel</button>
                      <button onClick={() => handleSaveEdit(post.id)} className="save-btn">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {post.content && <p>{renderContentWithMentions(post.content)}</p>}

                    {/* Repost Content */}
                    {post.repostData && (
                      <div className="repost-container">
                        <div className="repost-header-mini">
                          {((user && post.repostData.authorId === user.uid && user.photoURL) || (post.repostData.authorId !== user?.uid && post.repostData.avatar && !post.repostData.avatar.includes('dicebear'))) ? (
                            <img 
                              src={(user && post.repostData.authorId === user.uid) ? user.photoURL : post.repostData.avatar} 
                              alt={post.repostData.author} 
                              className="repost-avatar-mini" 
                            />
                          ) : (
                            <InitialsAvatar 
                              name={post.repostData.author} 
                              uid={post.repostData.authorId} 
                              className="repost-avatar-mini"
                              size={24}
                              fontSize="10px"
                            />
                          )}
                          <div className="repost-info-mini">
                            <span className="repost-author-name">{post.repostData.author}</span>
                            <span className="repost-time-mini">{getRelativeTime(post.repostData.timestamp)}</span>
                          </div>
                        </div>
                        <div className="repost-body">
                           <p className="post-content-mini">{renderContentWithMentions(post.repostData.content)}</p>
                           {post.repostData.linkPreview && (
                              <div className="post-link-preview">
                                {post.repostData.linkPreview.type === 'video' ? (
                                  <div className="video-embed-container">
                                    <iframe 
                                      src={post.repostData.linkPreview.embedUrl} 
                                      title={post.repostData.linkPreview.title}
                                      frameBorder="0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                ) : (
                                  <a href={post.repostData.linkPreview.url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                                     {post.repostData.linkPreview.image && (
                                       <div 
                                         className={`link-preview-image ${post.repostData.linkPreview.type === 'link' ? 'generic-preview' : ''}`} 
                                         style={{backgroundImage: `url(${post.repostData.linkPreview.image})`}}
                                       ></div>
                                     )}
                                     <div className="link-preview-content">
                                       <h4 className="link-title">{post.repostData.linkPreview.title}</h4>
                                       <p className="link-desc">{post.repostData.linkPreview.description}</p>
                                       <span className="link-source">🔗 {post.repostData.linkPreview.source}</span>
                                     </div>
                                  </a>
                                )}
                              </div>
                           )}
                           {(post.repostData.images || post.repostData.image) && (
                              <PostImagesGrid 
                                images={post.repostData.images || (post.repostData.image ? [{url: post.repostData.image}] : [])} 
                                onImageClick={(idx) => navigate(`/photo/${post.id}/${idx}`, { state: { backgroundLocation: location, scrollY: window.scrollY } })}
                              />
                           )}
                        </div>
                      </div>
                    )}

                    {!post.repostData && post.linkPreview && (
                      <div className="post-link-preview">
                        {post.linkPreview.type === 'video' ? (
                          <div className="video-embed-container">
                            <iframe 
                              src={post.linkPreview.embedUrl} 
                              title={post.linkPreview.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                        ) : (
                          <a href={post.linkPreview.url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                             {post.linkPreview.image && (
                               <div 
                                 className={`link-preview-image ${post.linkPreview.type === 'link' ? 'generic-preview' : ''}`} 
                                 style={{backgroundImage: `url(${post.linkPreview.image})`}}
                               ></div>
                             )}
                             <div className="link-preview-content">
                               <h4 className="link-title">{post.linkPreview.title}</h4>
                               <p className="link-desc">{post.linkPreview.description}</p>
                               <span className="link-source">🔗 {post.linkPreview.source}</span>
                             </div>
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {(post.images || post.image) && (
                <PostImagesGrid 
                  images={post.images || (post.image ? [{url: post.image}] : [])} 
                  onImageClick={(idx) => navigate(`/photo/${post.id}/${idx}`, { state: { backgroundLocation: location, scrollY: window.scrollY } })}
                />
              )}
              
              <div className="post-actions">
                <button 
                  className={`action-btn like-btn ${post.userVotes && post.userVotes[user?.uid] === 1 ? 'active' : ''}`}
                  onClick={() => handleVote(post.id, 1)}
                  title="Like"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={post.userVotes && post.userVotes[user?.uid] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <span>{post.score || 0}</span>
                </button>

                <button 
                  className={`action-btn dislike-btn ${post.userVotes && post.userVotes[user?.uid] === -1 ? 'active' : ''}`}
                  onClick={() => handleVote(post.id, -1)}
                  title="Dislike"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>

                <button className="action-btn comment-btn" onClick={() => toggleComments(post.id)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  <span>{post.comments > 0 ? post.comments : 'Comment'}</span>
                </button>

                <button className="action-btn repost-btn" onClick={() => handleRepost(post)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                  </svg>
                  <span>{post.shares > 0 ? post.shares : 'Repost'}</span>
                </button>

                <button 
                  className={`action-btn save-btn ${savedPosts[post.id] ? 'active' : ''}`}
                  onClick={() => handleSavePost(post.id)}
                  title={savedPosts[post.id] ? "Unsave" : "Save"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={savedPosts[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post.id && (
                <div className="comments-section">
                  <div className="comments-list">
                    {commentsData[post.id] && commentsData[post.id].length > 0 ? (
                      commentsData[post.id].map(comment => (
                        <div key={comment.id} className="comment-item">
                          {(comment.avatar && !comment.avatar.includes('dicebear')) ? (
                            <img src={comment.avatar} alt={comment.author} className="comment-avatar" />
                          ) : (
                            <InitialsAvatar 
                              name={comment.author} 
                              uid={comment.authorId} 
                              className="comment-avatar"
                              size={32}
                              fontSize="12px"
                            />
                          )}
                          <div className="comment-bubble">
                            {editingCommentId === comment.id ? (
                              <div className="edit-comment-area">
                                <input 
                                  type="text"
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  className="edit-comment-input"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditComment(post.id, comment.id);
                                    if (e.key === 'Escape') setEditingCommentId(null);
                                  }}
                                />
                                <div className="edit-comment-actions">
                                  <button onClick={() => handleSaveEditComment(post.id, comment.id)} className="save-btn-mini">Save</button>
                                  <button onClick={() => setEditingCommentId(null)} className="cancel-btn-mini">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="comment-header">
                                  <span className="comment-author">{comment.author}</span>
                                  {(user?.uid === comment.authorId || user?.uid === post.authorId) && (
                                    <div className="comment-options-container">
                                      <button 
                                        className="comment-options-trigger" 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setOpenCommentDropdownId(openCommentDropdownId === comment.id ? null : comment.id); 
                                        }}
                                      >
                                        •••
                                      </button>
                                      {openCommentDropdownId === comment.id && (
                                        <div className="comment-dropdown">
                                          {user?.uid === comment.authorId && (
                                            <button onClick={() => handleEditCommentClick(comment)}>Edit</button>
                                          )}
                                          <button className="delete-option" onClick={() => handleDeleteCommentClick(post.id, comment.id)}>Delete</button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <p className="comment-text">
                                  {renderContentWithMentions(comment.text)}
                                  {comment.isEdited && <span className="edited-label"> – edited</span>}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="no-comments">No comments yet. Be the first!</p>
                    )}
                  </div>
                  <div className="comment-input-area">
                    <div className="comment-input-wrapper">
                        <input 
                          type="text" 
                          placeholder="Write a comment..." 
                          value={commentText}
                          onChange={(e) => {
                              setCommentText(e.target.value);
                              handleInputMentions(e, 'comment');
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                          className="comment-input"
                          ref={commentInputRef}
                        />
                        <button onClick={() => handleSubmitComment(post.id)} className="comment-submit-btn">
                          ➤
                        </button>
                        {mentionTarget === 'comment' && (
                            <UserSearchDropdown 
                               query={mentionQuery}
                               onSelect={handleSelectMention}
                               position={{ bottom: '100%', left: 0 }}
                               allowedUsers={myFriends}
                            />
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="home-sidebar right-sidebar">
        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="sidebar-title" style={{ margin: 0 }}>Hacker News</h3>
            <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {loadingNews && news.length === 0 ? (
            <p className="loading-text">Fetching latest intel...</p>
          ) : (
            <>
              {news.slice(0, newsLimit).map(item => (
                <div key={item.id} className="news-item">
                  <span className="news-icon">📰</span>
                  <div className="news-content" style={{ textAlign: 'left' }}>
                    <h4>
                      <a href={item.url || `https://news.ycombinator.com/item?id=${item.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.title}
                      </a>
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--capy-text-secondary)' }}>
                      <a href={`https://news.ycombinator.com/item?id=${item.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--capy-accent)' }}>Discuss</a>
                    </p>
                  </div>
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', borderTop: '1px solid var(--capy-border)', paddingTop: '8px' }}>
                <button 
                  onClick={() => setNewsLimit(prev => Math.max(3, prev - 3))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: newsLimit <= 3 ? 0.3 : 1 }}
                  disabled={newsLimit <= 3}
                  title="Show Less"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button 
                  onClick={() => setNewsLimit(prev => prev + 3)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: newsLimit >= newsIds.length ? 0.3 : 1 }}
                  disabled={newsLimit >= newsIds.length}
                  title="Show More"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </>
          )}
          {!loadingNews && news.length === 0 && (
             <p className="loading-text">No news available.</p>
          )}
        </div>

        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="sidebar-title" style={{ margin: 0 }}>Trending Topics</h3>
            <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="trend-timeframe-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '12px' }}>
            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((tf) => (
              <button 
                key={tf}
                onClick={() => setTrendTimeframe(tf.toLowerCase())}
                style={{
                   background: trendTimeframe === tf.toLowerCase() ? 'var(--capy-accent)' : 'transparent',
                   color: trendTimeframe === tf.toLowerCase() ? '#fff' : 'var(--capy-text-secondary)',
                   border: 'none',
                   padding: '4px 8px',
                   borderRadius: '12px',
                   cursor: 'pointer',
                   fontWeight: trendTimeframe === tf.toLowerCase() ? 'bold' : 'normal',
                   transition: 'all 0.2s'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {trends.length > 0 ? (
            <>
              {trends.slice(0, trendLimit).map((trend, index) => (
                <div 
                  key={index} 
                  className={`trending-item ${selectedTrend === trend.tag ? 'active' : ''}`}
                  onClick={() => handleTrendClick(trend.tag)}
                >
                  <span className="hashtag">{trend.tag}</span>
                  <span className="post-count">{trend.count} posts</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', borderTop: '1px solid var(--capy-border)', paddingTop: '8px' }}>
                <button 
                  onClick={() => setTrendLimit(prev => Math.max(3, prev - 3))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: trendLimit <= 3 ? 0.3 : 1 }}
                  disabled={trendLimit <= 3}
                  title="Show Less"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button 
                  onClick={() => setTrendLimit(prev => prev + 3)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: trendLimit >= trends.length ? 0.3 : 1 }}
                  disabled={trendLimit >= trends.length}
                  title="Show More"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="trending-item">
              <span className="hashtag">--</span>
              <span className="post-count">No trends yet</span>
            </div>
          )}
        </div>
      </aside>
      
      {/* Floating Action Button */}
      <button className="fab-create" onClick={() => document.querySelector('.create-post-input').focus()}>
        <span>+</span>
      </button>

      <CapyModal {...modalConfig} onClose={closeModal} />
      
      {/* Mini Profile Card */}
      {selectedUser && (
        <MiniProfileCard 
          targetUid={selectedUser.uid} 
          position={{ x: selectedUser.x, y: selectedUser.y }}
          initialName={selectedUser.initialName}
          initialAvatar={selectedUser.initialAvatar}
          onClose={() => setSelectedUser(null)} 
        />
      )}

      {lightboxOpen && (
        <ImageViewer 
          images={lightboxImages} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxOpen(false)} 
          post={lightboxPost}
          comments={lightboxPost ? (commentsData[lightboxPost.id] || []) : []}
          user={user}
        />
      )}
    </div>
  );
};

const PostImagesGrid = ({ images, onImageClick }) => {
  if (!images || images.length === 0) return null;
  const count = images.length;

  // Single Image
  if (count === 1) {
    return (
      <div className="post-image-container single-image">
        <img 
          src={images[0].url} 
          alt="Post content" 
          className="post-image" 
          onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
          style={{ 
            cursor: 'pointer', 
            width: '100%', 
            height: 'auto', 
            maxHeight: '600px', 
            objectFit: 'contain',
            backgroundColor: 'rgba(0,0,0,0.02)',
            borderRadius: '8px'
          }}
        />
      </div>
    );
  }

  // 2 Images
  if (count === 2) {
    return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', height: '300px', overflow: 'hidden', borderRadius: '8px' }}>
        {images.map((img, idx) => (
          <img 
            key={idx}
            src={img.url}
            alt={`Post content ${idx}`}
            className="post-image"
            onClick={(e) => { e.stopPropagation(); onImageClick(idx); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          />
        ))}
      </div>
    );
  }

  // 3 Images (1 Left, 2 Right)
  if (count === 3) {
    return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', height: '300px', overflow: 'hidden', borderRadius: '8px' }}>
        <div style={{ position: 'relative', height: '100%' }}>
            <img 
              src={images[0].url}
              alt="Post content 0"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%' }}>
            <img 
              src={images[1].url}
              alt="Post content 1"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(1); }}
              style={{ width: '100%', height: '50%', objectFit: 'cover', cursor: 'pointer' }}
            />
            <img 
              src={images[2].url}
              alt="Post content 2"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(2); }}
              style={{ width: '100%', height: '50%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
      </div>
    );
  }
  
  // 4 Images (Grid)
  if (count === 4) {
     return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', height: '400px', overflow: 'hidden', borderRadius: '8px' }}>
        {images.map((img, idx) => (
          <img 
            key={idx}
            src={img.url}
            alt={`Post content ${idx}`}
            className="post-image"
            onClick={(e) => { e.stopPropagation(); onImageClick(idx); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          />
        ))}
      </div>
    );
  }

  // 5+ Images (2 Top, 3 Bottom)
  return (
      <div className="post-image-container multi-image-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Top Row: 2 images */}
        <div style={{ display: 'flex', gap: '2px', height: '250px' }}>
             <img 
              src={images[0].url}
              alt="Post content 0"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
              style={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
             <img 
              src={images[1].url}
              alt="Post content 1"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(1); }}
              style={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
        {/* Bottom Row: 3 images */}
        <div style={{ display: 'flex', gap: '2px', height: '166px' }}>
             <img 
              src={images[2].url}
              alt="Post content 2"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(2); }}
              style={{ width: '33.33%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
             <img 
              src={images[3].url}
              alt="Post content 3"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(3); }}
              style={{ width: '33.33%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
            <div style={{ position: 'relative', width: '33.33%', height: '100%', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onImageClick(4); }}>
                 <img 
                  src={images[4].url}
                  alt="Post content 4"
                  className="post-image"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {count > 5 && (
                    <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        backgroundColor: 'rgba(0,0,0,0.5)', 
                        color: 'white', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        fontSize: '28px', 
                        fontWeight: 'bold' 
                    }}>
                        +{count - 5}
                    </div>
                )}
            </div>
        </div>
      </div>
  );
};

const ImageViewer = ({ images, initialIndex, onClose, post, comments = [], user }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  // Scroll Lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
    >
      {/* Image Stage */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#000',
        minWidth: '0' // Fix flexbox overflow issue
      }}>
        {/* New Close Button - Floating Icon Only */}
        <div 
            onClick={onClose}
            style={{
                position: 'fixed', // Changed from absolute to fixed to ensure it stays in view
                top: '20px',
                left: '20px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '24px',
                cursor: 'pointer',
                zIndex: 20000, // Increased Z-index to be above everything
                lineHeight: 1,
                textShadow: '0 0 10px rgba(0, 0, 0, 0.6)',
                transition: 'transform 0.2s ease, color 0.2s ease',
                userSelect: 'none'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
            }}
            onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
            }}
        >
            ✕
        </div>

        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
            src={images[currentIndex].url} 
            alt={`Full view ${currentIndex}`}
            style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}
            />
        </div>
      </div>

      {/* Sidebar Info */}
      {post && (
          <div 
            style={{
                width: '360px',
                maxWidth: '100vw',
                backgroundColor: 'var(--capy-card-bg)',
                borderLeft: '1px solid var(--capy-border)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflowY: 'auto',
                flexShrink: 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--capy-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(post.avatar && !post.avatar.includes('dicebear')) ? (
                    <img src={post.avatar} alt={post.author} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <InitialsAvatar name={post.author} uid={post.authorId} size={40} />
                  )}
                  <div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--capy-text)' }}>{post.author}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>
                        {getRelativeTime(post.timestamp)}
                      </span>
                  </div>
              </div>

              {/* Content */}
              <div style={{ padding: '16px', color: 'var(--capy-text)', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {post.content}
              </div>

              {/* Stats */}
              <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--capy-border)', display: 'flex', justifyContent: 'space-between', color: 'var(--capy-text-secondary)', fontSize: '13px' }}>
                <span>{post.likes || 0} Likes</span>
                <span>{comments.length} Comments</span>
              </div>

              {/* Comments */}
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                {comments.length > 0 ? (
                    comments.map(comment => (
                        <div key={comment.id} style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                             {(comment.avatar && !comment.avatar.includes('dicebear')) ? (
                                <img src={comment.avatar} alt={comment.author} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <InitialsAvatar name={comment.author} uid={comment.authorId} size={32} fontSize="12px" />
                            )}
                            <div>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '18px', display: 'inline-block' }}>
                                    <h5 style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--capy-text)' }}>{comment.author}</h5>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--capy-text)' }}>{comment.text}</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--capy-text-secondary)', marginTop: '20px' }}>
                        No comments yet.
                    </div>
                )}
              </div>
          </div>
      )}
    </div>
  );
};

export default CapyHome;
