import { useState } from 'react';
import { Play, Plus, X } from 'lucide-react';
import { isValidStreamUrl } from '../lib/playlist';

export default function Playlist({ items, currentUrl, canControlRoom, onAdd, onRemove, onPlay, showToast }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!isValidStreamUrl(url.trim())) {
      showToast('That link needs to start with http:// or https://', 'error');
      return;
    }

    onAdd({ title, url: url.trim() });
    setTitle('');
    setUrl('');
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-4">
        <h3 className="text-[10px] sm:text-xs font-bold text-neutral-100 uppercase tracking-wider">
          Watchlist
        </h3>
        <span className="text-[8px] sm:text-[9px] text-neutral-500 uppercase">
          {items.length} saved
        </span>
      </div>

      {/* Add a new CDN link to the queue */}
      <form onSubmit={handleAdd} className="space-y-2.5 mb-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 px-3 py-2.5 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors"
        />
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-cdn.example/movie.mp4"
            className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 focus:border-neutral-500 px-3 py-2.5 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            aria-label="Add to watchlist"
            className="shrink-0 w-10 h-[42px] flex items-center justify-center border border-neutral-800 hover:border-neutral-500 bg-neutral-900 text-neutral-300 hover:text-neutral-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Past links, most recently added first. Tapping a row loads it for
          the whole room — host only, since only the host can write room state. */}
      {items.length === 0 ? (
        <p className="text-[9px] sm:text-[10px] text-neutral-600 uppercase leading-normal">
          Nothing saved yet. Add a link above to start a queue.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const isPlayingNow = item.url === currentUrl;
            return (
              <li
                key={item.id}
                className={`flex items-center gap-2 border p-2.5 ${
                  isPlayingNow ? 'border-orange-500/40 bg-orange-950/15' : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <button
                  onClick={() => onPlay(item)}
                  disabled={!canControlRoom}
                  aria-label={`Play ${item.title}`}
                  className="shrink-0 w-7 h-7 flex items-center justify-center border border-neutral-800 hover:border-orange-500 hover:text-orange-500 text-neutral-400 disabled:opacity-30 disabled:hover:border-neutral-800 disabled:hover:text-neutral-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-bold text-neutral-200 truncate uppercase">
                    {item.title}
                  </p>
                  {isPlayingNow && (
                    <span className="text-[8px] font-bold text-orange-500 uppercase">Now playing</span>
                  )}
                </div>

                <button
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.title}`}
                  className="shrink-0 text-neutral-600 hover:text-neutral-300 p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 1 && (
        <p className="text-[8px] sm:text-[9px] text-neutral-600 uppercase mt-4 pt-3 border-t border-neutral-900">
          When the host's video ends, the next item in this list plays automatically.
        </p>
      )}
    </div>
  );
}
