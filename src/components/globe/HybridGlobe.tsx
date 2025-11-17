import React from 'react';
import MapboxGlobe from './MapboxGlobe';

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  // Use only Mapbox for smooth Google Earth-style experience
  return <MapboxGlobe onClose={onClose} />;
}
