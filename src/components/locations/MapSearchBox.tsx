import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { geocodeIranNominatim } from '@/lib/geocoding';

interface SearchResult {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
}

type ResultsPlacement = 'top' | 'bottom';

interface MapSearchBoxProps {
  onLocationSelect: (lat: number, lng: number, placeName: string) => void;
  placeholder?: string;
  className?: string;
  showSearchButton?: boolean;
  resultsPlacement?: ResultsPlacement;
}

export function MapSearchBox({
  onLocationSelect,
  placeholder = 'جستجوی آدرس...',
  className,
  showSearchButton = false,
  resultsPlacement = 'bottom',
}: MapSearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
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
    console.log('[MapSearchBox] searchPlaces called:', { query });

    if (!query.trim() || query.length < 2) {
      console.log('[MapSearchBox] Query too short, skipping');
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await geocodeIranNominatim(query);
      console.log('[MapSearchBox] Results found:', searchResults.length);
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
    } catch (error) {
      console.error('[MapSearchBox] Geocoding error:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);

    // Debounce search - جستجوی خودکار هنگام تایپ
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 400);
  };

  const handleSearchClick = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    searchPlaces(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchClick();
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onLocationSelect(result.lat, result.lng, result.place_name);
    setSearchTerm(result.place_name.split(',')[0]);
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
  };

  const resultsPositionClass =
    resultsPlacement === 'top'
      ? 'absolute bottom-full mb-1 w-full'
      : 'absolute top-full mt-1 w-full';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="pr-9 pl-8 bg-background/95 backdrop-blur-sm border-border/50 shadow-md"
            dir="rtl"
          />
          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : searchTerm ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>

        {showSearchButton && (
          <Button
            onClick={handleSearchClick}
            disabled={loading || !searchTerm.trim()}
            size="icon"
            className="h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* لیست نتایج */}
      {isOpen && results.length > 0 && (
        <div
          className={cn(
            resultsPositionClass,
            'bg-background border border-border rounded-md shadow-lg z-[200001] max-h-64 overflow-y-auto'
          )}
        >
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
