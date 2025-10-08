import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { default: 1, sm: 2, md: 3 },
  gap = 4,
  className 
}: ResponsiveGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  const gapClasses = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  };

  const classes = cn(
    'grid',
    cols.default && gridCols[cols.default as keyof typeof gridCols],
    cols.sm && `sm:${gridCols[cols.sm as keyof typeof gridCols]}`,
    cols.md && `md:${gridCols[cols.md as keyof typeof gridCols]}`,
    cols.lg && `lg:${gridCols[cols.lg as keyof typeof gridCols]}`,
    cols.xl && `xl:${gridCols[cols.xl as keyof typeof gridCols]}`,
    gapClasses[gap as keyof typeof gapClasses] || 'gap-4',
    className
  );

  return (
    <div className={classes}>
      {children}
    </div>
  );
}
