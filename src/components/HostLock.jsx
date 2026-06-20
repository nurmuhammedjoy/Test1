import { ChevronRight } from 'lucide-react';

export default function HostLock({
  isAdminUnlocked,
  hasStoredPasscode,
  inputPasscode,
  onChangeInputPasscode,
  adminPasscode,
  onChangeAdminPasscode,
  onSubmit,
  onStepBack,
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <h3 className="text-[10px] sm:text-xs font-bold text-neutral-100 uppercase tracking-wider">
            Host lock
          </h3>
        </div>
        <span
          className={`text-[8px] sm:text-[9px] font-bold px-2 py-0.5 ${
            isAdminUnlocked ? 'bg-orange-600 text-black' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          {isAdminUnlocked ? 'HOST' : 'GUEST'}
        </span>
      </div>

      {!isAdminUnlocked ? (
        <div className="space-y-4">
          <p className="text-[9px] sm:text-[10px] text-neutral-500 leading-normal uppercase">
            Timeline and playback are locked. Grab host access to steer the room.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[8px] sm:text-[9px] font-bold text-neutral-500 uppercase mb-1.5">
                {hasStoredPasscode ? 'Enter host code' : 'Set host code'}
              </label>
              <input
                type="password"
                value={hasStoredPasscode ? inputPasscode : adminPasscode}
                onChange={(e) =>
                  hasStoredPasscode
                    ? onChangeInputPasscode(e.target.value)
                    : onChangeAdminPasscode(e.target.value)
                }
                placeholder={hasStoredPasscode ? '••••••' : 'e.g. 1234'}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 px-3 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={onSubmit}
              className="w-full h-9 sm:h-10 bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-[9px] sm:text-[10px] uppercase transition-colors"
            >
              {hasStoredPasscode ? 'Unlock host mode' : 'Save host mode'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-orange-500/30 bg-orange-950/25 p-3">
            <span className="text-[8px] sm:text-[9px] font-bold text-orange-500 uppercase block mb-1">
              Host mode on
            </span>
            <p className="text-[9px] sm:text-[10px] text-neutral-300 leading-normal uppercase">
              Playback changes will roll out to everyone in the room.
            </p>
          </div>

          <button
            onClick={onStepBack}
            className="w-full h-9 sm:h-10 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 text-[9px] sm:text-[10px] uppercase transition-colors"
          >
            Step back
          </button>
        </div>
      )}
    </div>
  );
}
