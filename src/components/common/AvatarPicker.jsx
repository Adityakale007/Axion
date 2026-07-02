import { AVATARS } from '../../lib/avatars';
import AvatarGlyph from './AvatarGlyph';

export default function AvatarPicker({ selected, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        Pick your character
      </p>
      <div className="grid grid-cols-2 gap-2">
        {AVATARS.map((avatar) => {
          const isSelected = selected === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onChange(avatar.id)}
              className={`
                flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150
                ${isSelected
                  ? 'scale-[1.03] border-amber-400 bg-amber-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }
              `}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-gray-100"
                style={{ color: avatar.color }}
              >
                <AvatarGlyph avatar={avatar} className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {avatar.name}
              </span>
              <span className="text-center text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                {avatar.trait}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
