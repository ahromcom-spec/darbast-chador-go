import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
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

// Camera animation component
function CameraController({ projects }: { projects: ProjectMarker[] }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (projects.length === 0) return;

    // Phase 0: Start from far away
    camera.position.set(0, 0, 15);
    
    // Phase 1: Zoom to Iran after 1 second
    const timer1 = setTimeout(() => {
      setAnimationPhase(1);
      const iranLat = 32.4279;
      const iranLng = 53.688;
      const iranPos = latLngToVector3(iranLat, iranLng, 5);
      
      animateCamera(camera, iranPos, 2000);
    }, 1000);

    // Phase 2: Zoom to projects after 3 seconds
    const timer2 = setTimeout(() => {
      setAnimationPhase(2);
      if (projects.length > 0) {
        const firstProject = projects[0];
        const projectPos = latLngToVector3(firstProject.lat, firstProject.lng, 3.5);
        animateCamera(camera, projectPos, 2000);
      }
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [projects, camera]);

  const animateCamera = (cam: THREE.Camera, targetPos: THREE.Vector3, duration: number) => {
    const startPos = cam.position.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      cam.position.lerpVectors(startPos, targetPos, eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={true}
      enablePan={false}
      minDistance={3}
      maxDistance={15}
      autoRotate={animationPhase === 0}
      autoRotateSpeed={0.5}
    />
  );
}

function Earth({ projects }: { projects: ProjectMarker[] }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Load earth texture
  const earthTexture = useLoader(THREE.TextureLoader, '/earth-texture.jpg');

  useFrame(() => {
    if (earthRef.current && !hovered) {
      earthRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group>
      {/* Main Earth sphere with real map texture */}
      <Sphere
        ref={earthRef}
        args={[2.5, 128, 128]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          map={earthTexture}
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>
      
      {/* Golden glow overlay */}
      <Sphere args={[2.52, 128, 128]}>
        <meshStandardMaterial
          color="#ffd700"
          emissive="#d4a574"
          emissiveIntensity={0.2}
          transparent
          opacity={0.1}
          roughness={0.3}
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
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <Card className="p-4 bg-background/90 backdrop-blur-sm border-2 border-primary/20">
          <p className="text-center text-lg font-bold text-foreground">
            پروژه‌های شما روی نقشه
          </p>
          <p className="text-center text-sm text-muted-foreground mt-1">
            {projectMarkers.length} پروژه فعال
          </p>
        </Card>
      </div>

      <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1.8} color="#ffffff" />
          <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#ffffff" />
          <pointLight position={[0, 5, 5]} intensity={0.5} color="#ffd700" />
          <Earth projects={projectMarkers} />
          <CameraController projects={projectMarkers} />
        </Suspense>
      </Canvas>
    </div>
  );
}
