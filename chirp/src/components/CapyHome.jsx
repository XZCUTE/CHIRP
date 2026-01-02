import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, update, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import './CapyHome.css';
import CapyModal from './CapyModal';

const CapyHome = () => {
  const [posts, setPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [newsIds, setNewsIds] = useState([]);
  const [newsLimit, setNewsLimit] = useState(3);
  const [scanIndex, setScanIndex] = useState(0); // For scanning HN IDs
  const [trends, setTrends] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [activeTab, setActiveTab] = useState('CapyHome');
  const [loadingNews, setLoadingNews] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [myFriends, setMyFriends] = useState({});
  const [postPrivacy, setPostPrivacy] = useState('world'); // world, cappies, self
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  
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
      setLinkPreviewData(null);
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

      // 1. Check for Special Handlers (YouTube, Vimeo, Images)
      // Image Direct Link
      if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            title: 'Image Preview',
            description: 'Click to view full image',
            image: url,
            type: 'image',
            source: 'Image'
          });
          setIsGeneratingPreview(false);
        }
        return;
      }

      // YouTube
      const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      if (ytMatch) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            type: 'video',
            source: 'YouTube',
            videoId: ytMatch[1],
            title: 'YouTube Video', 
            description: 'Watch this video on Chirp',
            image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
            embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
          });
          setIsGeneratingPreview(false);
        }
        return;
      }
      
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/([0-9]+)/);
      if (vimeoMatch) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            type: 'video',
            source: 'Vimeo',
            videoId: vimeoMatch[1],
            title: 'Vimeo Video',
            description: 'Watch this video on Chirp',
            image: null, // Vimeo requires API for image, or let generic handler catch it if we want image
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
          });
          setIsGeneratingPreview(false);
        }
        return;
      }

      // 2. Generic Sites - Fetch Metadata using Microlink API
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success' && isMounted) {
          const { title, description, image, logo, publisher } = result.data;
          
          setLinkPreviewData({
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
        if (isMounted) {
          // Fallback to basic info
          setLinkPreviewData({
            url: url,
            title: hostname,
            description: `Visit ${hostname} to see more.`,
            image: `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: hostname
          });
        }
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
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsData, setCommentsData] = useState({}); // Map of postId -> comments array
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);

  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;

  // Fetch Friends for Privacy
  useEffect(() => {
    if (!user) {
      setMyFriends({});
      return;
    }
    const friendsRef = ref(db, `users/${user.uid}/friends`);
    const unsubscribe = onValue(friendsRef, (snapshot) => {
      setMyFriends(snapshot.val() || {});
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

  // Fetch Posts and Calculate Trends
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
        calculateTrends(postsArray);
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

  const calculateTrends = (currentPosts) => {
    const hashtagCounts = {};
    let totalHashtagsFound = 0;

    currentPosts.forEach(post => {
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
                avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
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

    try {
      // Add comment to subcollection
      await push(ref(db, `posts/${postId}/comments_list`), {
        text: commentText,
        author: user.displayName || 'Anonymous Capy',
        authorId: user.uid,
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
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

  const handlePostSubmit = async () => {
    if (!newPostContent.trim()) return;
    
    try {
      const newPost = {
        content: newPostContent,
        author: user?.displayName || 'Anonymous Capy',
        authorId: user?.uid,
        avatar: user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'anon'}`,
        role: 'User', // Default role
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        shares: 0,
        privacy: postPrivacy
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
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleEditClick = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setOpenDropdownId(null);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    try {
      await update(ref(db, `posts/${postId}`), {
        content: editContent,
        isEdited: true
      });
      setEditingPostId(null);
      setEditContent('');
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
    <div className="capy-home-container">
      {/* Left Sidebar */}
      <aside className="home-sidebar left-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => setActiveTab(item.label)}
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
            <img 
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'guest'}`} 
              alt="Me" 
              className="user-avatar-small" 
            />
            <input 
              type="text" 
              placeholder="What's on your mind, Capy? Use #hashtags to trend!" 
              className="create-post-input"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostSubmit()}
            />
          </div>

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
                {postPrivacy === 'world' && '🌎 World'}
                {postPrivacy === 'cappies' && '🐾 Connections'}
                {postPrivacy === 'self' && '🔒 Self'}
                <span className="dropdown-arrow">▼</span>
              </button>
              {showPrivacyMenu && (
                <div className="privacy-menu">
                  <button onClick={() => { setPostPrivacy('world'); setShowPrivacyMenu(false); }} className={postPrivacy === 'world' ? 'active' : ''}>
                    🌎 World (Public)
                  </button>
                  <button onClick={() => { setPostPrivacy('cappies'); setShowPrivacyMenu(false); }} className={postPrivacy === 'cappies' ? 'active' : ''}>
                    🐾 Connections
                  </button>
                  <button onClick={() => { setPostPrivacy('self'); setShowPrivacyMenu(false); }} className={postPrivacy === 'self' ? 'active' : ''}>
                    🔒 Self (Private)
                  </button>
                </div>
              )}
            </div>

            <button 
              className={`post-action-btn ${showLinkPreview ? 'active' : ''}`}
              onClick={() => setShowLinkPreview(!showLinkPreview)}
            >
              🔗 Web Link
            </button>
            <button className="post-action-btn">📷 Photo/GIF</button>
            <button className="post-action-btn post-submit-btn" onClick={handlePostSubmit}>Post</button>
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
                <img src={post.avatar} alt={post.author} className="post-avatar" />
                <div className="post-info">
                  <span className="post-author">{post.author}</span>
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
                        <button onClick={() => handleEditClick(post)}>✏️ Edit</button>
                        <button onClick={() => handleDeleteClick(post)} className="delete-option">🗑️ Delete</button>
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
                      className="edit-post-textarea"
                    />
                    <div className="edit-actions">
                      <button onClick={() => setEditingPostId(null)} className="cancel-btn">Cancel</button>
                      <button onClick={() => handleSaveEdit(post.id)} className="save-btn">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {post.content && <p>{post.content}</p>}

                    {/* Repost Content */}
                    {post.repostData && (
                      <div className="repost-container">
                        <div className="repost-header-mini">
                          <img src={post.repostData.avatar} alt={post.repostData.author} className="repost-avatar-mini" />
                          <div className="repost-info-mini">
                            <span className="repost-author-name">{post.repostData.author}</span>
                            <span className="repost-time-mini">{getRelativeTime(post.repostData.timestamp)}</span>
                          </div>
                        </div>
                        <div className="repost-body">
                           <p className="post-content-mini">{post.repostData.content}</p>
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
                           {post.repostData.image && (
                              <div className="post-image-container-mini">
                                <img src={post.repostData.image} alt="Repost content" className="post-image" />
                              </div>
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
              
              {post.image && (
                <div className="post-image-container">
                  <img src={post.image} alt="Post content" className="post-image" />
                </div>
              )}
              
              <div className="post-actions">
                <div className="vote-group">
                  <button 
                    className={`action-btn vote-btn ${post.userVotes && post.userVotes[user?.uid] === 1 ? 'active-goody' : ''}`}
                    onClick={() => handleVote(post.id, 1)}
                    title="Approve"
                  >
                    ✓
                  </button>
                  <span className="vote-count">{post.score || 0}</span>
                  <button 
                    className={`action-btn vote-btn ${post.userVotes && post.userVotes[user?.uid] === -1 ? 'active-bady' : ''}`}
                    onClick={() => handleVote(post.id, -1)}
                    title="Disapprove"
                  >
                    ✕
                  </button>
                </div>
                <button className="action-btn" onClick={() => toggleComments(post.id)}>
                  💬 Comment {post.comments > 0 && <span>{post.comments}</span>}
                </button>
                <button className="action-btn" onClick={() => handleRepost(post)}>
                  🔁 Repost {post.shares > 0 && <span>{post.shares}</span>}
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post.id && (
                <div className="comments-section">
                  <div className="comments-list">
                    {commentsData[post.id] && commentsData[post.id].length > 0 ? (
                      commentsData[post.id].map(comment => (
                        <div key={comment.id} className="comment-item">
                          <img src={comment.avatar} alt={comment.author} className="comment-avatar" />
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
                                  {comment.text}
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
                    <input 
                      type="text" 
                      placeholder="Write a comment..." 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                      className="comment-input"
                    />
                    <button onClick={() => handleSubmitComment(post.id)} className="comment-submit-btn">
                      ➤
                    </button>
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
          <h3 className="sidebar-title">Hacker News</h3>
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
              
              {newsLimit < newsIds.length && (
                <button 
                  className="capy-btn capy-btn-secondary" 
                  style={{ width: '100%', marginTop: '10px', padding: '8px', fontSize: '12px' }}
                  onClick={() => setNewsLimit(prev => prev + 3)}
                >
                  See More
                </button>
              )}
            </>
          )}
          {!loadingNews && news.length === 0 && (
             <p className="loading-text">No news available.</p>
          )}
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-title">Trending Topics</h3>
          {trends.length > 0 ? (
            trends.map((trend, index) => (
              <div 
                key={index} 
                className={`trending-item ${selectedTrend === trend.tag ? 'active' : ''}`}
                onClick={() => handleTrendClick(trend.tag)}
              >
                <span className="hashtag">{trend.tag}</span>
                <span className="post-count">{trend.count} posts</span>
              </div>
            ))
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
    </div>
  );
};

export default CapyHome;
