import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ProjectMarker {
  lat: number;
  lng: number;
  title: string;
  address: string;
  id: string;
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function ProjectMarkers({ projects }: { projects: ProjectMarker[] }) {
  return (
    <>
      {projects.map((project) => {
        const position = latLngToVector3(project.lat, project.lng, 2.01);
        return (
          <mesh key={project.id} position={position}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#ffd700" emissive="#ffa500" emissiveIntensity={0.5} />
            <Html distanceFactor={10}>
              <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-border">
                {project.title || project.address}
              </div>
            </Html>
          </mesh>
        );
      })}
    </>
  );
}

function Earth({ projects }: { projects: ProjectMarker[] }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (earthRef.current && !hovered) {
      earthRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group>
      <Sphere
        ref={earthRef}
        args={[2, 64, 64]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color="#1e40af"
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>
      <ProjectMarkers projects={projects} />
    </group>
  );
}

export default function InteractiveGlobe({ onClose }: { onClose: () => void }) {
  const { projects } = useProjectsHierarchy();
  const [projectMarkers, setProjectMarkers] = useState<ProjectMarker[]>([]);

  useEffect(() => {
    const markers = projects
      .filter(p => p.locations?.lat && p.locations?.lng)
      .map(p => ({
        lat: p.locations!.lat,
        lng: p.locations!.lng,
        title: p.title || '',
        address: p.locations!.address_line || '',
        id: p.id
      }));
    setProjectMarkers(markers);
  }, [projects]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="absolute top-4 left-4 z-10">
        <Card className="p-4">
          <h2 className="text-lg font-bold mb-2">پروژه‌های شما</h2>
          <p className="text-sm text-muted-foreground">
            {projectMarkers.length} پروژه روی نقشه
          </p>
        </Card>
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />
          <Earth projects={projectMarkers} />
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={3}
            maxDistance={8}
            autoRotate={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
