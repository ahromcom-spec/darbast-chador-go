import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { X, MapPin, Building2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface OrderMarker {
  lat: number;
  lng: number;
  orderId: string;
  code: string;
  address: string;
  customerName: string;
  status: string;
  subcategoryName: string;
  count: number;
  orders: Array<{
    id: string;
    code: string;
    status: string;
    address: string;
    customerName: string;
  }>;
}

interface ExecutiveGlobeProps {
  onClose: () => void;
  onOrderClick?: (orderId: string) => void;
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function OrderMarkers({ orders, onOrderClick }: { orders: OrderMarker[], onOrderClick?: (orderId: string) => void }) {
  const statusColors: Record<string, { color: string; emissive: string }> = {
    pending: { color: '#ff9800', emissive: '#ff6600' },
    approved: { color: '#4caf50', emissive: '#2e7d32' },
    in_progress: { color: '#2196f3', emissive: '#1565c0' },
    completed: { color: '#9c27b0', emissive: '#7b1fa2' },
    paid: { color: '#00bcd4', emissive: '#00838f' },
  };

  return (
    <>
      {orders.map((order, index) => {
        const position = latLngToVector3(order.lat, order.lng, 2.51);
        const hasMultiple = order.count > 1;
        const colors = statusColors[order.status] || { color: '#ffd700', emissive: '#ffa500' };
        
        return (
          <mesh 
            key={order.orderId + index} 
            position={position}
            onClick={(e) => {
              e.stopPropagation();
              if (onOrderClick) {
                onOrderClick(order.orderId);
              }
            }}
          >
            <sphereGeometry args={[hasMultiple ? 0.08 : 0.06, 16, 16]} />
            <meshStandardMaterial 
              color={hasMultiple ? '#ff9500' : colors.color}
              emissive={hasMultiple ? '#ff7700' : colors.emissive}
              emissiveIntensity={0.6} 
            />
            <Html distanceFactor={10}>
              <div 
                className={`bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg text-xs border shadow-lg max-w-[220px] cursor-pointer hover:border-primary transition-colors ${
                  hasMultiple ? 'border-amber-500' : 'border-border'
                }`}
                onClick={() => onOrderClick && onOrderClick(order.orderId)}
              >
                {hasMultiple && (
                  <div className="font-bold text-amber-500 mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {order.count} سفارش
                  </div>
                )}
                <div className="font-medium text-foreground mb-1">{order.code}</div>
                <div className="text-muted-foreground text-[10px]">{order.address}</div>
                {order.customerName && (
                  <div className="text-[10px] text-primary mt-1">👤 {order.customerName}</div>
                )}
                {hasMultiple && (
                  <div className="mt-1.5 pt-1 border-t border-border/50 space-y-0.5">
                    {order.orders.slice(0, 3).map((o, i) => (
                      <div 
                        key={o.id} 
                        className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOrderClick) onOrderClick(o.id);
                        }}
                      >
                        {i + 1}. {o.code}
                      </div>
                    ))}
                    {order.orders.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        و {order.orders.length - 3} سفارش دیگر...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Html>
          </mesh>
        );
      })}
    </>
  );
}

function CameraController({ orders }: { orders: OrderMarker[] }) {
  const { camera } = useThree();
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (orders.length === 0) return;

    const targetOrder = orders[0];

    camera.position.set(0, 0, 12);
    
    const timer1 = setTimeout(() => {
      setAnimationPhase(1);
      const iranLat = 32.4279;
      const iranLng = 53.688;
      const iranPos = latLngToVector3(iranLat, iranLng, 6);
      animateCamera(camera, iranPos, 1500);
    }, 800);

    const timer2 = setTimeout(() => {
      setAnimationPhase(2);
      if (targetOrder) {
        const projectPos = latLngToVector3(targetOrder.lat, targetOrder.lng, 4);
        animateCamera(camera, projectPos, 1200);
      }
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [orders, camera]);

  const animateCamera = (cam: THREE.Camera, targetPos: THREE.Vector3, duration: number) => {
    const startPos = cam.position.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      cam.position.lerpVectors(startPos, targetPos, eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  return (
    <OrbitControls
      enableZoom={true}
      enablePan={true}
      minDistance={2.8}
      maxDistance={15}
      autoRotate={animationPhase === 0}
      autoRotateSpeed={0.5}
    />
  );
}

function Earth({ orders, onOrderClick }: { orders: OrderMarker[], onOrderClick?: (orderId: string) => void }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const goldenTexture = useLoader(THREE.TextureLoader, '/golden-globe.png');

  useFrame(() => {
    if (earthRef.current && !hovered) {
      earthRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group>
      <Sphere
        ref={earthRef}
        args={[2.5, 128, 128]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          map={goldenTexture}
          roughness={0.4}
          metalness={0.6}
          emissive="#d4a574"
          emissiveIntensity={0.2}
        />
      </Sphere>
      
      <Sphere args={[2.52, 128, 128]}>
        <meshStandardMaterial
          color="#ffd700"
          emissive="#d4a574"
          emissiveIntensity={0.15}
          transparent
          opacity={0.08}
          roughness={0.2}
        />
      </Sphere>
      
      <OrderMarkers orders={orders} onOrderClick={onOrderClick} />
    </group>
  );
}

export default function ExecutiveGlobe({ onClose, onOrderClick }: ExecutiveGlobeProps) {
  const navigate = useNavigate();
  const [orderMarkers, setOrderMarkers] = useState<OrderMarker[]>([]);

  // همه سفارشات
  const { data: orders } = useQuery({
    queryKey: ['executive-globe-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          address,
          status,
          customer_name,
          location_lat,
          location_lng,
          subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code,
            service_types_v3 (
              id,
              name,
              code
            )
          )
        `)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .in('status', ['pending', 'approved', 'in_progress', 'completed', 'paid']);

      if (error) throw error;

      return data || [];
    }
  });

  useEffect(() => {
    if (!orders || orders.length === 0) {
      setOrderMarkers([]);
      return;
    }

    // گروه‌بندی سفارشات بر اساس موقعیت
    const locationGroups: { [key: string]: typeof orders } = {};
    
    orders.forEach(order => {
      if (!order.location_lat || !order.location_lng) return;
      
      const key = `${order.location_lat.toFixed(5)}_${order.location_lng.toFixed(5)}`;
      
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(order);
    });

    const markers: OrderMarker[] = Object.values(locationGroups).map(group => {
      const first = group[0];
      return {
        lat: first.location_lat!,
        lng: first.location_lng!,
        orderId: first.id,
        code: first.code,
        address: first.address || '',
        customerName: first.customer_name || '',
        status: first.status || 'pending',
        subcategoryName: first.subcategories?.name || '',
        count: group.length,
        orders: group.map(o => ({
          id: o.id,
          code: o.code,
          status: o.status || 'pending',
          address: o.address || '',
          customerName: o.customer_name || ''
        }))
      };
    });
    
    setOrderMarkers(markers);
  }, [orders]);

  const handleOrderClick = (orderId: string) => {
    if (onOrderClick) {
      onOrderClick(orderId);
    } else {
      navigate(`/executive/orders?orderId=${orderId}`);
    }
    onClose();
  };

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
        <Card className="p-6 bg-gradient-to-br from-background/95 to-background/90 backdrop-blur-md border-2 border-primary/30 shadow-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
              <p className="text-center text-xl font-bold text-foreground">
                همه سفارشات روی نقشه
              </p>
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">استان قم</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full">
                <Package className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">{orderMarkers.length} موقعیت</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-full">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">{orders?.length || 0} سفارش</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">برای مدیریت روی هر سفارش کلیک کنید</p>
          </div>
        </Card>
      </div>

      <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1.8} color="#ffffff" />
          <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#ffffff" />
          <pointLight position={[0, 5, 5]} intensity={0.5} color="#ffd700" />
          <Earth orders={orderMarkers} onOrderClick={handleOrderClick} />
          <CameraController orders={orderMarkers} />
        </Suspense>
      </Canvas>
    </div>
  );
}
