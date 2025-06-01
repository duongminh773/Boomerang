// Format date to relative time (e.g., "2 days ago")
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Truncate text to a max length
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}

// Create Twitter-like tweet card
function createBookmarkCard(bookmark) {
  const content = truncateText(bookmark.description || '', 300);
  return `
    <div class="tweet-card" data-id="${bookmark.id}">
      <img src="${bookmark.favicon || 'icons/icon-48.png'}" alt="Avatar" class="tweet-avatar" onerror="this.src='icons/icon-48.png'">
      <div class="tweet-main">
        <a href="${bookmark.url}" class="tweet-title" target="_blank">${bookmark.title}</a>
        <div class="tweet-meta">
          ${bookmark.domain} · ${formatRelativeTime(bookmark.savedAt)}${bookmark.readTime ? ` · ${bookmark.readTime} min read` : ''}
        </div>
        <div class="tweet-content">
          ${content}
          ${bookmark.description && bookmark.description.length > 300 ? `<a href="${bookmark.url}" class="tweet-readmore" target="_blank">Read more</a>` : ''}
        </div>
        ${bookmark.image ? `<img src="${bookmark.image}" alt="Hero" class="tweet-hero" onerror="this.style.display='none'">` : ''}
        <div class="tweet-actions">
          <button class="tweet-action like-button ${bookmark.isLiked ? 'liked' : ''}" title="Like">
            ${bookmark.isLiked
              ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C12 21 4 13.36 4 8.5C4 5.42 6.42 3 9.5 3C11.24 3 12.91 3.81 14 5.08C15.09 3.81 16.76 3 18.5 3C21.58 3 24 5.42 24 8.5C24 13.36 16 21 16 21H12Z"/></svg>`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: grayscale(1);"><path d="M12 21C12 21 4 13.36 4 8.5C4 5.42 6.42 3 9.5 3C11.24 3 12.91 3.81 14 5.08C15.09 3.81 16.76 3 18.5 3C21.58 3 24 5.42 24 8.5C24 13.36 16 21 16 21H12Z"/></svg>`
            }
          </button>
          <button class="tweet-action archive-button" title="Archive">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L22 12 L12 22 L2 12 Z" /></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Show empty state
function showEmptyState() {
  return `
    <div class="empty-state">
      <img src="icons/icon-64.png" alt="Boomerang" class="empty-state-icon">
      <p class="empty-state-text">No boomerangs in flight</p>
      <p class="empty-state-subtext">Click the Boomerang icon in your toolbar to start saving pages!</p>
    </div>
  `;
}

// --- Sidebar Navigation Logic ---

let currentView = 'feed'; // 'feed', 'archived', 'notifications'

function setActiveNav(id) {
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showFeed() {
  setActiveNav('nav-feed');
  document.querySelector('.subtitle').textContent = 'Your throws are returning';
  loadFeed();
}

function showArchived() {
  setActiveNav('nav-archived');
  document.querySelector('.subtitle').textContent = 'Your archived boomerangs';
  loadFeed(true);
}

function showNotifications() {
  setActiveNav('nav-notifications');
  document.querySelector('.subtitle').textContent = 'Notifications';
  renderNotifications();
}

// --- Profile/Stats ---
async function renderProfileStats() {
  const bookmarks = await getAllBookmarks();
  const archived = bookmarks.filter(b => b.isArchived);
  const liked = bookmarks.filter(b => b.isLiked);
  const total = bookmarks.length;

  // Most active domains
  const domainCounts = {};
  bookmarks.forEach(b => {
    if (!domainCounts[b.domain]) domainCounts[b.domain] = 0;
    domainCounts[b.domain]++;
  });
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain, count]) => `${domain} (${count})`)
    .join(', ');

  // Streaks: count max consecutive days with at least one save
  const days = bookmarks.map(b => new Date(b.savedAt).toDateString());
  const uniqueDays = Array.from(new Set(days)).sort();
  let streak = 0, maxStreak = 0, prev = null;
  uniqueDays.forEach(day => {
    if (!prev) { streak = 1; }
    else {
      const diff = (new Date(day) - new Date(prev)) / (1000*60*60*24);
      streak = diff === 1 ? streak + 1 : 1;
    }
    if (streak > maxStreak) maxStreak = streak;
    prev = day;
  });

  const statsEl = document.getElementById('profileStats');
  statsEl.innerHTML = `
    <div>Total saved: <b>${total}</b></div>
    <div>Liked: <b>${liked.length}</b></div>
    <div>Archived: <b>${archived.length}</b></div>
    <div>Most active: <b>${topDomains || 'N/A'}</b></div>
    <div>Streak: <b>${maxStreak}</b> days</div>
  `;

  // Set default avatar and name
  document.getElementById('profileName').textContent = 'User';
  document.querySelector('.sidebar-profile-avatar').src = 'icons/icon-48.png';
}

// --- Notifications ---
// Store notifications in chrome.storage.sync under 'notifications' key
function scheduleDailyNotifications() {
  // Only run in background context
  if (!chrome.alarms) return;
  chrome.alarms.create('boomerangDaily', { when: Date.now() + 1000, periodInMinutes: 1440 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'boomerangDaily') {
      generateRandomNotifications();
    }
  });
}

async function generateRandomNotifications() {
  const result = await chrome.storage.sync.get('bookmarks');
  const bookmarks = result.bookmarks || [];
  const candidates = bookmarks.filter(b => !b.isArchived && Date.now() - b.savedAt > 3*24*60*60*1000);
  const notifications = [];
  for (let i = 0; i < 3 && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const b = candidates.splice(idx, 1)[0];
    notifications.push({
      id: b.id,
      title: b.title,
      url: b.url,
      domain: b.domain,
      time: Date.now(),
      message: `🪃 Your boomerang returns! ${b.title}`
    });
  }
  await chrome.storage.sync.set({ notifications });
}

async function renderNotifications() {
  const feed = document.getElementById('bookmarkFeed');
  const result = await chrome.storage.sync.get('notifications');
  const notifications = result.notifications || [];
  if (notifications.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <img src="icons/icon-64.png" alt="Notifications" class="empty-state-icon">
        <p class="empty-state-text">No notifications yet</p>
        <p class="empty-state-subtext">You will see reminders here when your boomerangs return!</p>
      </div>
    `;
    return;
  }
  feed.innerHTML = notifications.map(n => `
    <div class="tweet-card">
      <div class="tweet-main">
        <div class="tweet-meta">${n.domain} · ${formatRelativeTime(n.time)}</div>
        <div class="tweet-content">${n.message}</div>
        <a href="${n.url}" class="tweet-readmore" target="_blank">Catch now</a>
      </div>
    </div>
  `).join('');
}

// --- Feed/Archived Rendering ---
async function loadFeed(showArchived = false) {
  const feedEl = document.getElementById('bookmarkFeed');
  feedEl.innerHTML = '<div class="loading">Catching your boomerangs...</div>';
  try {
    console.log('Loading bookmarks, showArchived:', showArchived);
    const bookmarks = await getAllBookmarks();
    console.log('Retrieved bookmarks:', bookmarks);
    
    if (bookmarks.length === 0) {
      console.log('No bookmarks found');
      feedEl.innerHTML = showArchived
        ? `<div class="empty-state"><p class="empty-state-text">No archived boomerangs</p></div>`
        : `<div class="empty-state"><img src="icons/icon-64.png" alt="Boomerang" class="empty-state-icon"><p class="empty-state-text">No boomerangs in flight</p><p class="empty-state-subtext">Click the Boomerang icon in your toolbar to start saving pages!</p></div>`;
      return;
    }

    const filtered = bookmarks.filter(b => showArchived ? b.isArchived : !b.isArchived);
    console.log('Filtered bookmarks:', filtered);
    
    if (filtered.length === 0) {
      console.log('No bookmarks after filtering');
      feedEl.innerHTML = showArchived
        ? `<div class="empty-state"><p class="empty-state-text">No archived boomerangs</p></div>`
        : `<div class="empty-state"><img src="icons/icon-64.png" alt="Boomerang" class="empty-state-icon"><p class="empty-state-text">No boomerangs in flight</p><p class="empty-state-subtext">Click the Boomerang icon in your toolbar to start saving pages!</p></div>`;
      return;
    }

    const feedHTML = filtered.map(createBookmarkCard).join('');
    console.log('Generated feed HTML');
    feedEl.innerHTML = feedHTML;

    // Add event listeners
    document.querySelectorAll('.like-button').forEach(button => {
      button.addEventListener('click', handleLike);
    });
    document.querySelectorAll('.archive-button').forEach(button => {
      button.addEventListener('click', handleArchive);
    });
    console.log('Added event listeners to buttons');
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    feedEl.innerHTML = `<div class="error">Oops! Dropped the boomerang. Try again?</div>`;
  }
  renderProfileStats();
}

// Handle like button click
async function handleLike(event) {
  const button = event.currentTarget;
  const card = button.closest('.tweet-card');
  const bookmarkId = card.dataset.id;
  try {
    const key = `bm_${bookmarkId}`;
    const result = await browser.storage.sync.get(key);
    const bookmark = result[key];
    if (bookmark) {
      bookmark.isLiked = !bookmark.isLiked;
      await browser.storage.sync.set({ [key]: bookmark });
      loadFeed();
    } else {
      console.error('Bookmark not found:', bookmarkId);
    }
  } catch (error) {
    console.error('Error updating like status:', error);
  }
}

// Handle archive button click
async function handleArchive(event) {
  const button = event.currentTarget;
  const card = button.closest('.tweet-card');
  const bookmarkId = card.dataset.id;
  try {
    const key = `bm_${bookmarkId}`;
    const result = await browser.storage.sync.get(key);
    const bookmark = result[key];
    if (bookmark) {
      bookmark.isArchived = true;
      await browser.storage.sync.set({ [key]: bookmark });
      card.style.opacity = '0';
      setTimeout(() => {
        loadFeed();
      }, 300);
    } else {
      console.error('Bookmark not found:', bookmarkId);
    }
  } catch (error) {
    console.error('Error archiving bookmark:', error);
  }
}

// Helper: Get all bookmark IDs from sync storage
async function getBookmarkIds() {
  const result = await browser.storage.sync.get('bookmark_ids');
  if (!result || !result.bookmark_ids) return [];
  return result.bookmark_ids;
}

// Helper: Get all bookmarks in order
async function getAllBookmarks() {
  const ids = await getBookmarkIds();
  if (ids.length === 0) return [];
  const keys = ids.map(id => `bm_${id}`);
  const result = await browser.storage.sync.get(keys);
  if (!result) return [];
  // Return in order of ids
  return ids.map(id => result[`bm_${id}`]).filter(Boolean);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nav-feed').addEventListener('click', showFeed);
  document.getElementById('nav-archived').addEventListener('click', showArchived);
  document.getElementById('nav-notifications').addEventListener('click', showNotifications);
  showFeed();
  renderProfileStats();
  scheduleDailyNotifications();
}); 