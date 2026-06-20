import { useState } from 'react';
import { addPlaylistItem, loadPlaylist, removePlaylistItem } from '../lib/playlist';

// Lazy initializer so we only touch localStorage once, on first render.
export function usePlaylist() {
  const [items, setItems] = useState(() => loadPlaylist());

  const addItem = (entry) => setItems((current) => addPlaylistItem(current, entry));
  const removeItem = (id) => setItems((current) => removePlaylistItem(current, id));

  return { items, addItem, removeItem };
}
