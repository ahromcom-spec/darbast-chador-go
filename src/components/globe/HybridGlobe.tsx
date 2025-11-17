import React, { useState, useEffect } from 'react';
import InteractiveGlobe from './InteractiveGlobe';
import MapboxGlobe from './MapboxGlobe';

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // After 7.5 seconds (after all zoom animations), switch to real Mapbox map
    const timer = setTimeout(() => {
      console.log('Switching to Mapbox map...');
      setShowMap(true);
    }, 7500);

    return () => clearTimeout(timer);
  }, []);

  if (!showMap) {
    return <InteractiveGlobe onClose={onClose} />;
  }

  return <MapboxGlobe onClose={onClose} />;
}
