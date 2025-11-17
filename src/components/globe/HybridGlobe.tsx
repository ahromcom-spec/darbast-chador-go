import React, { useState, useEffect } from 'react';
import InteractiveGlobe from './InteractiveGlobe';
import MapboxGlobe from './MapboxGlobe';

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  const [phase, setPhase] = useState<'golden' | 'map'>('golden');

  useEffect(() => {
    // After 7 seconds (after all zoom animations), switch to real map
    const timer = setTimeout(() => {
      setPhase('map');
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  if (phase === 'golden') {
    return <InteractiveGlobe onClose={onClose} />;
  }

  return <MapboxGlobe onClose={onClose} />;
}
