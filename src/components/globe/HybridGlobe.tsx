import React, { useState, useEffect } from 'react';
import InteractiveGlobe from './InteractiveGlobe';
import MapboxGlobe from './MapboxGlobe';

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  const [phase, setPhase] = useState<'golden' | 'map'>('golden');
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    // Safety timeout: if map didn't get ready in time, stay on golden
    const safety = setTimeout(() => {
      if (!mapReady) setMapFailed(true);
    }, 10000);
    return () => clearTimeout(safety);
  }, [mapReady]);

  // While map is not ready, show golden globe
  if (!mapReady && !mapFailed) {
    return (
      <>
        <InteractiveGlobe onClose={onClose} />
        {/* Pre-mount hidden Mapbox to start loading and call onReady when done */}
        <div style={{ display: 'none' }}>
          <MapboxGlobe onClose={onClose} onReady={() => setMapReady(true)} onError={() => setMapFailed(true)} />
        </div>
      </>
    );
  }

  if (mapFailed) {
    return <InteractiveGlobe onClose={onClose} />;
  }

  // Map is ready
  return <MapboxGlobe onClose={onClose} />;
}
