// Inject browser-polyfill if available (for Firefox/Chrome cross-compat)
// (No importScripts in content scripts, but browser-polyfill.js is injected by manifest or background)

console.log('Content script loaded');

// Function to get meta content
function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return meta ? meta.getAttribute('content') : null;
}

// Function to get first significant image
function getFirstSignificantImage() {
  // Try OpenGraph image first
  const ogImage = getMetaContent('og:image');
  if (ogImage) return ogImage;

  // Try Twitter card image
  const twitterImage = getMetaContent('twitter:image');
  if (twitterImage) return twitterImage;

  // Look for first image that's not too small
  const images = Array.from(document.getElementsByTagName('img'));
  const significantImage = images.find(img => {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    return width >= 200 && height >= 200;
  });
  
  return significantImage ? significantImage.src : null;
}

// Function to estimate reading time
function estimateReadingTime() {
  const text = document.body.innerText;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / 200); // Assuming 200 words per minute
}

// Function to get YouTube video duration
function getYouTubeDuration() {
  if (!window.location.hostname.includes('youtube.com')) return null;
  
  const durationElement = document.querySelector('.ytp-time-duration');
  return durationElement ? durationElement.textContent : null;
}

// Main function to extract all metadata
function extractMetadata() {
  console.log('Extracting metadata from page');
  
  const metadata = {
    title: document.title,
    description: getMetaContent('og:description') || getMetaContent('description') || '',
    image: getFirstSignificantImage(),
    favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href,
    readTime: estimateReadingTime(),
    type: window.location.hostname.includes('youtube.com') ? 'video' : 'article',
    url: window.location.href,
    domain: window.location.hostname
  };

  if (metadata.type === 'video') {
    metadata.duration = getYouTubeDuration();
  }

  console.log('Extracted metadata:', metadata);
  return metadata;
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((request, sender) => {
  console.log('Content script received message:', request);
  if (request.action === 'extractMetadata') {
    try {
      const metadata = extractMetadata();
      console.log('Sending metadata back to popup:', metadata);
      return Promise.resolve(metadata);
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return Promise.resolve({ error: error.message });
    }
  }
}); 