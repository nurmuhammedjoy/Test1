// Playlist is stored client-side only — nothing here ever touches Firestore.
// Using localStorage instead of an actual cookie: cookies get attached to
// every network request and cap out around 4KB, which is a bad fit for a
// growing list of links. localStorage stays on-device and holds way more.
const STORAGE_KEY = 'watch-together:playlist';
const MAX_ITEMS = 50;

// Read the saved list. Wrapped in try/catch because localStorage can throw
// in private browsing mode on some browsers, or hold corrupted JSON.
export function loadPlaylist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlaylist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — fail quietly, playlist just won't persist.
  }
}

// Adds a link to the top of the list. If the URL already exists, it gets
// moved to the top with the new title instead of creating a duplicate row.
export function addPlaylistItem(items, { title, url }) {
  const cleanUrl = url.trim();
  const cleanTitle = title.trim() || cleanUrl;

  const withoutDupe = items.filter((item) => item.url !== cleanUrl);
  const next = [
    { id: crypto.randomUUID(), title: cleanTitle, url: cleanUrl, addedAt: Date.now() },
    ...withoutDupe,
  ].slice(0, MAX_ITEMS);

  savePlaylist(next);
  return next;
}

export function removePlaylistItem(items, id) {
  const next = items.filter((item) => item.id !== id);
  savePlaylist(next);
  return next;
}

// Basic guard so people don't accidentally save garbage into the queue.
export function isValidStreamUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
