import { Check, Copy } from 'lucide-react';

export default function RoomHeader({ roomId, syncStatus, role, copied, onCopyRoomId }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 text-[10px] sm:text-xs w-full md:w-auto">
      <div className="flex items-center h-9 sm:h-10 border border-neutral-800 bg-neutral-900 px-2 sm:px-3 flex-1 sm:flex-initial justify-between">
        <div>
          <span className="text-neutral-500 mr-1 sm:mr-2">ROOM</span>
          <span className="text-neutral-100 font-bold">{roomId}</span>
        </div>
        <button onClick={onCopyRoomId} className="ml-2 hover:text-orange-500 transition-colors p-0.5">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center h-9 sm:h-10 border border-neutral-800 bg-neutral-900 px-3">
        <span className="text-neutral-500 mr-2">SYNC</span>
        <span className={`font-bold ${syncStatus === 'ONLINE' ? 'text-emerald-500' : 'text-orange-500'}`}>
          {syncStatus}
        </span>
      </div>

      <div
        className={`h-9 sm:h-10 px-3 flex items-center justify-center font-bold text-center ${
          role === 'admin' ? 'bg-orange-600 text-black' : 'border border-neutral-800 text-neutral-400'
        }`}
      >
        {role === 'admin' ? 'HOST' : 'GUEST'}
      </div>
    </div>
  );
}
