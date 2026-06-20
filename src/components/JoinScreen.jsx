import { ChevronRight } from 'lucide-react';

export default function JoinScreen({ inputRoomId, onChangeRoomId, onJoin }) {
  return (
    <div className="col-span-12 max-w-md mx-auto w-full py-12 sm:py-16">
      <div className="border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
        <div className="mb-6 border-b border-neutral-900 pb-4">
          <h2 className="text-xs sm:text-sm font-bold text-neutral-100 tracking-widest uppercase">
            Jump in
          </h2>
          <p className="text-[10px] text-neutral-500 mt-1 uppercase">Drop the room code</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Room code
            </label>
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => onChangeRoomId(e.target.value)}
              placeholder="hangout-01"
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 px-3 py-2.5 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={onJoin}
            className="w-full h-11 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-black font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            Join room <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
