import { useEffect, useState } from 'react';

interface Snowflake {
  id: number;
  x: number;
  size: number;
  animationDuration: number;
  animationDelay: number;
  opacity: number;
}

const Snowfall = () => {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
      setSnowflakes([]);
      return;
    }

    const isMobile = window.matchMedia?.('(max-width: 768px)')?.matches;

    const flakes: Snowflake[] = [];
    const count = isMobile ? 18 : 32;

    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        x: Math.random() * 100,
        size: Math.random() * 4 + 2,
        animationDuration: Math.random() * 5 + 5,
        animationDelay: Math.random() * 5,
        opacity: Math.random() * 0.6 + 0.4,
      });
    }

    setSnowflakes(flakes);
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      style={{ height: '150vh', contain: 'paint' }}
    >
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute rounded-full animate-snowfall will-change-transform"
          style={{
            left: `${flake.x}%`,
            top: '-20px',
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
            backgroundColor: 'hsl(var(--primary-foreground) / 0.95)',
          }}
        />
      ))}
    </div>
  );
};

export default Snowfall;
