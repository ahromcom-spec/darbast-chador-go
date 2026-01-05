import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapSearchBoxProps {
  onLocationSelect: (lat: number, lng: number, placeName: string) => void;
  placeholder?: string;
  className?: string;
}

export function MapSearchBox({ 
  onLocationSelect, 
  placeholder = "جستجوی آدرس...",
  className 
}: MapSearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // دریافت توکن Mapbox
  useEffect(() => {
    const cached = sessionStorage.getItem('mapbox_token');
    if (cached) {
      setMapboxToken(cached);
      return;
    }

    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
          sessionStorage.setItem('mapbox_token', data.token);
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
      }
    };

    fetchToken();
  }, []);

  // بستن نتایج با کلیک خارج
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2 || !mapboxToken) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Mapbox Geocoding API
      // محدود به ایران و با اولویت فارسی
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams({
        access_token: mapboxToken,
        country: 'IR',
        language: 'fa',
        limit: '5',
        types: 'place,locality,neighborhood,address,poi'
      });

      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const searchResults: SearchResult[] = data.features.map((feature: any) => ({
          id: feature.id,
          place_name: feature.place_name,
          center: feature.center
        }));
        setResults(searchResults);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mapboxToken]);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  const handleSelectResult = (result: SearchResult) => {
    const [lng, lat] = result.center;
    onLocationSelect(lat, lng, result.place_name);
    setSearchTerm(result.place_name);
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
  };

  if (!mapboxToken) {
    return null; // اگر توکن موجود نباشد، کادر جستجو نمایش داده نمی‌شود
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pr-9 pl-8 bg-background/95 backdrop-blur-sm border-border/50 shadow-md"
          dir="rtl"
        />
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        ) : searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* لیست نتایج */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-background border border-border rounded-md shadow-lg z-[200001] max-h-64 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className="w-full px-3 py-2 text-right hover:bg-accent flex items-start gap-2 border-b border-border/50 last:border-b-0 transition-colors"
            >
              <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground line-clamp-2">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
