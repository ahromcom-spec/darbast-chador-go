import { useState, useEffect } from 'react';
import { getPublicContractors, PublicContractor } from '@/lib/contractors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Award } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

/**
 * Component for displaying public contractor directory
 * ✅ SECURE: Only displays non-sensitive information
 * ❌ Does NOT expose: email, phone_number, contact_person
 * 
 * For contact information, use getContractorContactInfo() 
 * which requires proper authorization (admin/manager/owner)
 */
export function PublicContractorList() {
  const [contractors, setContractors] = useState<PublicContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContractors();
  }, []);

  const loadContractors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✅ SECURE: Uses safe function that doesn't expose contact info
      const data = await getPublicContractors();
      setContractors(data);
    } catch (err: any) {
      console.error('Error loading contractors:', err);
      setError('خطا در بارگذاری لیست پیمانکاران');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground text-sm">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (contractors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">هیچ پیمانکاری یافت نشد</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contractors.map((contractor) => (
          <ContractorCard key={contractor.id} contractor={contractor} />
        ))}
      </div>
      
      {/* Security Notice */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 text-sm">
          🔒 <strong>حریم خصوصی:</strong> اطلاعات تماس پیمانکاران (ایمیل و تلفن) محافظت شده و 
          فقط برای مدیران سیستم قابل مشاهده است.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ContractorCard({ contractor }: { contractor: PublicContractor }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {contractor.company_name}
            </CardTitle>
            {contractor.general_location && (
              <CardDescription className="flex items-center gap-1 mt-2">
                <MapPin className="h-3.5 w-3.5" />
                {contractor.general_location}
              </CardDescription>
            )}
          </div>
          
          {contractor.is_approved && (
            <Badge variant="outline" className="gap-1">
              <Award className="h-3 w-3" />
              تایید شده
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Description */}
        {contractor.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {contractor.description}
          </p>
        )}
        
        {/* Experience */}
        {contractor.experience_years && (
          <div className="flex items-center gap-2 text-sm">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {contractor.experience_years} سال تجربه
            </span>
          </div>
        )}
        
        {/* Services */}
        {contractor.services && contractor.services.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {contractor.services.map((service, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {service.service_type === 'scaffolding' ? 'داربست' : 
                 service.service_type === 'tarpaulin' ? 'برزنت' : service.service_type}
                {service.sub_type && ` - ${service.sub_type}`}
              </Badge>
            ))}
          </div>
        )}
        
        {/* 
          ⚠️ SECURITY NOTE:
          Contact information (email, phone_number, contact_person) 
          is NOT displayed here for security reasons.
          
          To access contact info, you must:
          1. Be an admin, general manager, or the contractor themselves
          2. Use getContractorContactInfo(contractor.id)
          3. All access will be logged in audit_log
        */}
      </CardContent>
    </Card>
  );
}
