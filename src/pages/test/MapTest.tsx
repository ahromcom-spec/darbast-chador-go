import { useState } from 'react';
import SimpleLeafletMap from '@/components/locations/SimpleLeafletMap';
import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function MapTest() {
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">تست نقشه - شهر قم</h1>
        </div>

        <div className="h-[500px] w-full rounded-xl border-2 border-border overflow-hidden shadow-lg">
          <SimpleLeafletMap
            onLocationSelect={(lat, lng) => {
              setSelected({ lat, lng });
              console.log('✅ موقعیت انتخاب شد:', { lat, lng });
            }}
            initialLat={34.6416}
            initialLng={50.8746}
          />
        </div>

        {selected && (
          <div className="bg-primary/10 border border-primary rounded-lg p-4">
            <p className="font-bold text-primary mb-2">✓ موقعیت انتخاب شده:</p>
            <div className="flex gap-4 font-mono text-sm">
              <span>عرض جغرافیایی: {selected.lat.toFixed(6)}</span>
              <span>طول جغرافیایی: {selected.lng.toFixed(6)}</span>
            </div>
          </div>
        )}

        <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
          <p className="font-bold">راهنمای استفاده:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>نقشه باید فوراً شهر قم را نشان دهد (زوم 12)</li>
            <li>با کلیک روی نقشه، موقعیت انتخاب می‌شود</li>
            <li>marker قرمز روی نقطه انتخابی ظاهر می‌شود</li>
            <li>مختصات در پایین نمایش داده می‌شود</li>
            <li>با scroll می‌توانید zoom کنید</li>
            <li>با drag می‌توانید نقشه را جابجا کنید</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
