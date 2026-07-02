export const AVATARS = [
  {
    id: 'clever-fox',
    name: 'Clever Fox',
    emoji: '🦊',
    trait: 'Greedy algorithms. Always finds the shortcut.',
    color: '#f97316',
    bgColor: '#fff7ed',
    darkBg: '#431407',
  },
  {
    id: 'nerdy-owl',
    name: 'Nerdy Owl',
    emoji: '🦉',
    trait: 'Reads the editorial twice before attempting.',
    color: '#a78bfa',
    bgColor: '#f5f3ff',
    darkBg: '#2e1065',
  },
  {
    id: 'silent-bear',
    name: 'Silent Bear',
    emoji: '🐻',
    trait: 'Brute forces first. Optimizes when it fails.',
    color: '#78716c',
    bgColor: '#fafaf9',
    darkBg: '#1c1917',
  },
  {
    id: 'debug-raccoon',
    name: 'Debug Raccoon',
    emoji: '🦝',
    trait: 'Lives in the output panel. Print statements everywhere.',
    color: '#6b7280',
    bgColor: '#f9fafb',
    darkBg: '#111827',
  },
  {
    id: 'speedy-cheetah',
    name: 'Speedy Cheetah',
    emoji: '🐆',
    trait: 'Optimizes for submission speed. First to hit Run.',
    color: '#eab308',
    bgColor: '#fefce8',
    darkBg: '#422006',
  },
  {
    id: 'calm-tortoise',
    name: 'Calm Tortoise',
    emoji: '🐢',
    trait: 'Reads constraints three times. Never gets WA.',
    color: '#22c55e',
    bgColor: '#f0fdf4',
    darkBg: '#052e16',
  },
];

export function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function getAvatarById(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}
