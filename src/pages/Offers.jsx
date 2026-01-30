import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Offers.css';

const Offers = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null); // 'jobs', 'marketplace', 'services'
  const [filter, setFilter] = useState('all');

  const sidebarItems = [
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

  const categories = [
    {
      id: 'jobs',
      title: 'Job Offers',
      description: 'Find your dream job, internship, or OJT opportunity.',
      icon: '💼',
      filters: ['All', 'Remote', 'Onsite', 'Internship'],
      items: [
        { id: 1, title: 'Junior React Developer', company: 'TechCorp', type: 'Remote', salary: '$2k - $4k', badge: '🔥 Trending' },
        { id: 2, title: 'Cybersecurity Analyst', company: 'SecureNet', type: 'Onsite', salary: '$5k - $8k', badge: '✅ Verified' },
        { id: 3, title: 'Frontend Intern', company: 'StartupX', type: 'Internship', salary: 'Unpaid', badge: '🎓 Student-friendly' },
      ]
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      description: 'Buy and sell digital and hardware tech products.',
      icon: '🛒',
      filters: ['All', 'Digital', 'Hardware'],
      items: [
        { id: 1, title: 'Mechanical Keyboard Keycaps', seller: 'KeyMaster', price: '$45', type: 'Hardware', badge: '🔥 Trending' },
        { id: 2, title: 'Python Automation Scripts', seller: 'CodeWizard', price: '$15', type: 'Digital', badge: '✅ Verified' },
        { id: 3, title: 'Raspberry Pi 4 Kit', seller: 'IoT_Shop', price: '$85', type: 'Hardware', badge: '' },
      ]
    },
    {
      id: 'services',
      title: 'Services & Gigs',
      description: 'Hire experts or offer your tech services.',
      icon: '🤝',
      filters: ['All', 'Development', 'Security', 'Design'],
      items: [
        { id: 1, title: 'Custom Website Development', provider: 'WebPro', price: 'Starting at $200', tags: ['Development'], badge: '✅ Verified' },
        { id: 2, title: 'Vulnerability Assessment', provider: 'SecExpert', price: '$500', tags: ['Security'], badge: '🔥 Trending' },
        { id: 3, title: 'UI/UX Design for Mobile App', provider: 'PixelPerfect', price: '$150', tags: ['Design'], badge: '' },
      ]
    }
  ];

  const activeCategory = categories.find(c => c.id === activeSection);

  const handleSidebarClick = (item) => {
    if (item.label === 'CapyHome') navigate('/home');
    else if (item.label === 'Connections') navigate('/connections');
    else if (item.label === 'CapyDEVS') navigate('/devs');
    else if (item.label === 'CapyTips') navigate('/tips');
    else if (item.label === 'Reels') navigate('/reels');
    else if (item.label === 'Activities') navigate('/activities');
    else if (item.label === 'Learn') navigate('/learn');
    else if (item.label === 'Offers') navigate('/offers');
    else if (item.label === 'Recruit') navigate('/recruit');
    else if (item.label === 'Crew') navigate('/crew');
    else if (item.label === 'Play') navigate('/play');
    else if (item.label === 'Settings') navigate('/settings');
  };

  return (
    <div className="offers-page-wrapper">
      <aside className="offers-sidebar">
        <div className="sidebar-menu">
          {sidebarItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Offers' ? 'active' : ''}`}
              onClick={() => handleSidebarClick(item)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="offers-container">
        {!activeSection ? (
          <div className="offers-selection-grid">
            <h1 className="offers-page-title">Explore Offers</h1>
            <div className="cards-grid">
              {categories.map((category) => (
                <div 
                  key={category.id} 
                  className="offer-category-card"
                  onClick={() => setActiveSection(category.id)}
                >
                  <div className="card-icon">{category.icon}</div>
                  <h2>{category.title}</h2>
                  <p>{category.description}</p>
                  <div className="card-glow"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="offers-detail-view">
            <button className="back-btn" onClick={() => setActiveSection(null)}>
              ← Back to Categories
            </button>
            
            <div className="detail-header">
              <div className="header-left">
                <h1>{activeCategory.icon} {activeCategory.title}</h1>
                <p>{activeCategory.description}</p>
              </div>
              <button className="post-offer-btn">
                + Post {activeCategory.id === 'jobs' ? 'Job' : activeCategory.id === 'marketplace' ? 'Item' : 'Gig'}
              </button>
            </div>

            <div className="filters-bar">
              {activeCategory.filters.map(f => (
                <button 
                  key={f} 
                  className={`filter-chip ${filter === f.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setFilter(f.toLowerCase())}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="items-list">
              {activeCategory.items.map(item => (
                <div key={item.id} className="item-card">
                  <div className="item-info">
                    <h3>{item.title}</h3>
                    <p className="item-sub">
                      {item.company || item.seller || item.provider} • 
                      <span className="item-price">{item.salary || item.price}</span>
                    </p>
                    <div className="item-badges">
                      <span className="type-badge">{item.type || item.tags?.[0]}</span>
                      {item.badge && <span className="special-badge">{item.badge}</span>}
                    </div>
                  </div>
                  <button className="view-btn">View</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Offers;
