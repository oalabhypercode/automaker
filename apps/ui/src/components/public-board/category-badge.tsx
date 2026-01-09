import { Bug, HelpCircle, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicTicketCategory } from '@/hooks/use-public-project';

interface CategoryBadgeProps {
  category: PublicTicketCategory;
  size?: 'sm' | 'md';
}

interface CategoryConfig {
  icon: LucideIcon;
  label: string;
  className: string;
}

const CATEGORY_CONFIG: Record<PublicTicketCategory, CategoryConfig> = {
  feature: {
    icon: Sparkles,
    label: 'Feature',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  bug: {
    icon: Bug,
    label: 'Bug',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  question: {
    icon: HelpCircle,
    label: 'Frage',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
};

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        padding,
        textSize,
        config.className
      )}
    >
      <Icon className={iconSize} />
      <span>{config.label}</span>
    </span>
  );
}
