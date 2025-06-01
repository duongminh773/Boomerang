document.addEventListener('DOMContentLoaded', async () => {
  const messageEl = document.querySelector('.message');
  const savedTitleEl = document.querySelector('.saved-title');
  const viewAllEl = document.querySelector('.view-all');

  try {
    console.log('[Popup] Querying active tab...');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    console.log('[Popup] Current tab:', tab);
    
    if (!tab) {
      console.error('[Popup] No active tab found');
      throw new Error('No active tab found');
    }

    // No need to inject content script, it's always present
    console.log('[Popup] Sending message to content script to extract metadata...');

    // Get metadata with retries
    let metadata;
    for (let i = 0; i < 3; i++) {
      try {
        metadata = await browser.tabs.sendMessage(tab.id, { action: 'extractMetadata' });
        console.log(`[Popup] Received metadata on attempt ${i+1}:`, metadata);
        if (metadata && !metadata.error) break;
      } catch (error) {
        console.error(`[Popup] Error sending message to content script on attempt ${i+1}:`, error);
        if (i === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
    if (!metadata || metadata.error) {
      console.error('[Popup] Failed to get metadata:', metadata?.error);
      messageEl.textContent = 'Error: Could not extract page content';
      return;
    }
    console.log('[Popup] Final received metadata:', metadata);

    // Save bookmark
    try {
      console.log('[Popup] Sending saveBookmark message to background...');
      const response = await browser.runtime.sendMessage({ action: 'saveBookmark', metadata });
      console.log('[Popup] Received response from background:', response);
      if (response && response.success) {
        console.log('[Popup] Bookmark saved successfully:', response.bookmark);
        messageEl.textContent = 'Thrown! It\'ll come back around';
        savedTitleEl.textContent = metadata.title;
        savedTitleEl.style.display = 'block';
        viewAllEl.style.display = 'inline-block';
      } else {
        console.error('[Popup] Failed to save bookmark:', response?.error);
        messageEl.textContent = 'Error: Could not save bookmark';
      }
    } catch (error) {
      console.error('[Popup] Error saving bookmark:', error);
      messageEl.textContent = 'Error: Could not save bookmark';
    }
  } catch (error) {
    console.error('[Popup] Popup error:', error);
    messageEl.textContent = 'Error: Could not access page content';
  }
});

// Handle view all click
document.querySelector('.view-all').addEventListener('click', (e) => {
  e.preventDefault();
  browser.tabs.create({ url: 'newtab.html' });
}); 