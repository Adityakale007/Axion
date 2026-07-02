import { Bird, Cat, PawPrint, Rabbit, Rat, Turtle } from 'lucide-react';

const ICONS = {
  'clever-fox': Cat,
  'nerdy-owl': Bird,
  'silent-bear': PawPrint,
  'debug-raccoon': Rat,
  'speedy-cheetah': Rabbit,
  'calm-tortoise': Turtle,
};

export default function AvatarGlyph({ avatar, className = 'h-4 w-4' }) {
  const Icon = ICONS[avatar?.id] || Cat;
  return <Icon className={className} strokeWidth={2} />;
}
