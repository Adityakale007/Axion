import { getAvatarById } from '../../lib/avatars';
import AvatarGlyph from './AvatarGlyph';


// eslint-disable-next-line react/prop-types
function User({ username, isOnline, role, pairLabel, editorAccess, avatarId }) {
    const avatar = getAvatarById(avatarId);
    return (
        <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm">
            <div className="relative">
                <div className="ring-2 ring-gray-200 dark:ring-gray-700 rounded-full transition-all group-hover:ring-gray-300 dark:group-hover:ring-gray-600">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white text-gray-800 dark:bg-slate-900 dark:text-gray-100">
                        <AvatarGlyph avatar={avatar} className="h-4 w-4" />
                    </div>
                </div>
                {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900 shadow-sm animate-pulse"></div>
                )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-white truncate group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                    {username}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {role && (
                        <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                            {role}
                        </span>
                    )}
                    {pairLabel && (
                        <span className="inline-flex w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
                            {pairLabel}
                        </span>
                    )}
                    {editorAccess && (
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                            editorAccess === 'control'
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                                : 'bg-rose-100 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200'
                        }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${editorAccess === 'control' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {editorAccess === 'control' ? 'Can edit' : 'Read only'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isOnline ? "Active" : "Offline"}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default User
