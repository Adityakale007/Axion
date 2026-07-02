import { getAvatarById } from '../../lib/avatars';
import AvatarGlyph from './AvatarGlyph';

// eslint-disable-next-line react/prop-types
function User({ username, isOnline, role, pairLabel, editorAccess, avatarId }) {
    const avatar = getAvatarById(avatarId);
    
    return (
        <div className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:shadow-sm">
            
            {/* Avatar Section */}
            <div className="relative shrink-0">
                <div className="ring-2 ring-zinc-200 dark:ring-zinc-800 rounded-full transition-all duration-300 group-hover:ring-indigo-300 dark:group-hover:ring-indigo-500/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white text-zinc-800 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
                        <AvatarGlyph avatar={avatar} className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                </div>
                {/* Status Indicator Dot */}
                {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 shadow-sm"></div>
                )}
            </div>
            
            {/* User Info Section */}
            <div className="flex flex-col flex-1 min-w-0 justify-center">
                
                {/* Top Row: Name and Status Text */}
                <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {username}
                    </span>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        {isOnline ? "ACTIVE" : "OFFLINE"}
                    </span>
                </div>

                {/* Bottom Row: Tags & Badges */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {role && (
                        <span className="inline-flex w-fit rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {role}
                        </span>
                    )}
                    
                    {pairLabel && (
                        <span className="inline-flex w-fit rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {pairLabel}
                        </span>
                    )}
                    
                    {editorAccess && (
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            editorAccess === 'control'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'
                        }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${editorAccess === 'control' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></span>
                            {editorAccess === 'control' ? 'Editing' : 'Viewing'}
                        </span>
                    )}
                </div>
                
            </div>
        </div>
    )
}

export default User;