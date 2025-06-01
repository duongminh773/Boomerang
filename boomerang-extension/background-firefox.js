// Firefox version: no importScripts needed, polyfill is loaded by manifest

// Helper: Get all bookmark IDs
async function getBookmarkIds() {
  const result = await browser.storage.sync.get('bookmark_ids');
  if (!result || !result.bookmark_ids) return [];
  return result.bookmark_ids;
}

// Helper: Set all bookmark IDs
async function setBookmarkIds(ids) {
  await browser.storage.sync.set({ bookmark_ids: ids });
}

// Helper: Get all bookmarks (returns array, newest first)
async function getAllBookmarks() {
  const ids = await getBookmarkIds();
  if (ids.length === 0) return [];
  const keys = ids.map(id => `bm_${id}`);
  const result = await browser.storage.sync.get(keys);
  if (!result) return [];
  // Return in order of ids
  return ids.map(id => result[`bm_${id}`]).filter(Boolean);
}

// Function to save bookmark to Chrome sync storage
async function saveBookmark(metadata) {
  console.log('Saving bookmark with metadata:', metadata);
  if (!metadata || !metadata.url) {
    console.error('Invalid metadata:', metadata);
    throw new Error('Invalid metadata: missing required fields');
  }

  const id = Date.now().toString();
  const bookmark = {
    id,
    url: metadata.url,
    type: metadata.type || 'article',
    title: metadata.title || 'Untitled',
    description: metadata.description || '',
    image: metadata.image || null,
    favicon: metadata.favicon || null,
    savedAt: Date.now(),
    lastShown: null,
    isLiked: false,
    isArchived: false,
    clickCount: 0,
    domain: metadata.domain || new URL(metadata.url).hostname,
    readTime: metadata.readTime || 0
  };
  if (metadata.type === 'video') {
    bookmark.duration = metadata.duration;
  }

  try {
    // Get existing bookmark IDs
    let ids = await getBookmarkIds();
    // Add new ID to front
    ids.unshift(id);
    // Keep only last 200 bookmarks (sync quota safety)
    if (ids.length > 200) ids = ids.slice(0, 200);
    await setBookmarkIds(ids);
    // Save bookmark under its own key
    await browser.storage.sync.set({ [`bm_${id}`]: bookmark });
    console.log('Successfully saved bookmark:', bookmark);
    return bookmark;
  } catch (error) {
    console.error('Error saving bookmark:', error);
    throw error;
  }
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  if (request.action === 'saveBookmark') {
    if (!request.metadata) {
      console.error('No metadata provided in saveBookmark request');
      sendResponse({ success: false, error: 'No metadata provided' });
      return true;
    }
    saveBookmark(request.metadata)
      .then(bookmark => {
        console.log('Bookmark saved successfully:', bookmark);
        sendResponse({ success: true, bookmark });
      })
      .catch(error => {
        console.error('Failed to save bookmark:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }
  // Add handler for loading all bookmarks if needed
});

// --- Notification Scheduling and Display ---

// Helper: Get eligible bookmarks for notifications
async function getNotificationCandidates() {
  const ids = await getBookmarkIds();
  if (ids.length === 0) return [];
  const keys = ids.map(id => `bm_${id}`);
  const result = await browser.storage.sync.get(keys);
  const now = Date.now();
  // Not archived, older than 3 days
  return ids
    .map(id => result[`bm_${id}`])
    .filter(b => b && !b.isArchived && now - b.savedAt > 3 * 24 * 60 * 60 * 1000);
}

// Helper: Schedule notifications for today
async function scheduleBoomerangNotifications() {
  const candidates = await getNotificationCandidates();
  if (candidates.length === 0) return;
  // Pick up to 3 random bookmarks
  const picks = [];
  const pool = [...candidates];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  // Schedule at random times: morning (9-12), afternoon (12-17), evening (17-22)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windows = [
    [9, 12],   // morning
    [12, 17],  // afternoon
    [17, 22],  // evening
  ];
  picks.forEach((bookmark, i) => {
    const [start, end] = windows[i];
    const hour = Math.floor(Math.random() * (end - start)) + start;
    const minute = Math.floor(Math.random() * 60);
    const fireTime = new Date(today.getTime());
    fireTime.setHours(hour, minute, 0, 0);
    // If time already passed today, fire in 1 min
    const when = fireTime.getTime() > now.getTime() ? fireTime.getTime() : now.getTime() + 60 * 1000;
    browser.alarms.create(`boomerang_notify_${bookmark.id}`, { when });
    // Store notification info for click handling
    browser.storage.local.set({ [`notify_${bookmark.id}`]: bookmark });
  });
}

// On install/update, set up daily alarm
browser.runtime.onInstalled.addListener(() => {
  browser.alarms.create('boomerang_daily', {
    when: Date.now() + 5000, // start in 5s for demo/testing
    periodInMinutes: 24 * 60
  });
  scheduleBoomerangNotifications();
});

// On daily alarm, schedule today's notifications
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'boomerang_daily') {
    scheduleBoomerangNotifications();
  } else if (alarm.name.startsWith('boomerang_notify_')) {
    const bookmarkId = alarm.name.replace('boomerang_notify_', '');
    browser.storage.local.get(`notify_${bookmarkId}`).then(result => {
      const bookmark = result[`notify_${bookmarkId}`];
      if (bookmark) {
        browser.notifications.create(`boomerang_${bookmark.id}`, {
          type: 'basic',
          iconUrl: bookmark.favicon || 'icons/icon-128.png',
          title: '🪃 Your boomerang returns!',
          message: bookmark.title,
          contextMessage: `Thrown ${Math.round((Date.now() - bookmark.savedAt) / (24*60*60*1000))} days ago` || '',
          priority: 1
        });
      }
    });
  }
});

// On notification click, open the bookmark
browser.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('boomerang_')) {
    const bookmarkId = notificationId.replace('boomerang_', '');
    browser.storage.local.get(`notify_${bookmarkId}`).then(result => {
      const bookmark = result[`notify_${bookmarkId}`];
      if (bookmark && bookmark.url) {
        browser.tabs.create({ url: bookmark.url });
      }
    });
  }
}); 