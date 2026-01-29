import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Upload, X, FileImage, FileVideo, MessageSquare, XCircle } from "lucide-react";

interface ServiceRequest {
  id: string;
  service_type: string;
  created_at: string;
}

const NONE_VALUE = '__none__';

const departments = [
  { value: "order", label: "ثبت سفارش" },
  { value: "execution", label: "اجرایی" },
  { value: "support", label: "پشتیبانی" },
  { value: "financial", label: "مالی" },
  { value: "management", label: "مدیریت" }
];

const NewTicket = () => {
  const [department, setDepartment] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchServiceRequests();
  }, []);

  const fetchServiceRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServiceRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching service requests:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files);
    const totalSize = [...files, ...newFiles].reduce((sum, file) => sum + file.size, 0);
    const maxSize = 70 * 1024 * 1024; // 70MB

    if (totalSize > maxSize) {
      toast({
        title: "خطا",
        description: "حجم کل فایل‌ها نباید بیشتر از 70 مگابایت باشد",
        variant: "destructive"
      });
      return;
    }

    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async (ticketId: string, userId: string) => {
    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${ticketId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("ticket_attachments")
        .insert({
          ticket_id: ticketId,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type
        });

      if (dbError) throw dbError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!department || !subject || !message) {
      toast({
        title: "خطا در ثبت تیکت",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
        variant: "destructive"
      });
      return;
    }

    if (subject.trim().length < 5) {
      toast({
        title: "خطا در موضوع تیکت",
        description: "موضوع تیکت باید حداقل 5 کاراکتر باشد",
        variant: "destructive"
      });
      return;
    }

    if (message.trim().length < 20) {
      toast({
        title: "خطا در پیام",
        description: "پیام شما باید حداقل 20 کاراکتر باشد",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setUploading(files.length > 0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("کاربر وارد نشده است");

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department,
          subject,
          message,
          service_request_id: serviceRequestId
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (files.length > 0) {
        await uploadFiles(ticket.id, user.id);
      }

      toast({
        title: "✓ تیکت با موفقیت ثبت شد",
        description: "تیکت شما ثبت شد و به زودی توسط تیم پشتیبانی بررسی خواهد شد. از طریق صفحه تیکت‌ها می‌توانید وضعیت آن را پیگیری کنید."
      });

      navigate("/tickets");
    } catch (error: any) {
      toast({
        title: "خطا در ثبت تیکت",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const maxSize = 70 * 1024 * 1024;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/tickets")}
        className="mb-6 gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به لیست تیکت‌ها
      </Button>

      <Card className="shadow-lg">
        <CardHeader className="space-y-3 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">ایجاد تیکت جدید</CardTitle>
              <CardDescription>
                برای ارتباط با بخش‌های مختلف شرکت، تیکت خود را ثبت کنید
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="department" className="text-base font-semibold">
                بخش مورد نظر *
              </Label>
              <Select value={department} onValueChange={setDepartment} required>
                <SelectTrigger id="department" className="h-11">
                  <SelectValue placeholder="لطفاً بخش مورد نظر را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {dept.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                تیکت شما به بخش انتخاب شده ارسال می‌شود
              </p>
            </div>

            {serviceRequests.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="serviceRequest" className="text-base font-semibold">
                  پروژه/سفارش مرتبط (اختیاری)
                </Label>
                <Select
                  value={serviceRequestId ?? undefined}
                  onValueChange={(v) => setServiceRequestId(v === NONE_VALUE ? null : v)}
                >
                  <SelectTrigger id="serviceRequest" className="h-11">
                    <SelectValue placeholder="می‌توانید یکی از پروژه‌های خود را انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        بدون انتخاب پروژه
                      </div>
                    </SelectItem>
                    {serviceRequests.map((sr) => (
                      <SelectItem key={sr.id} value={sr.id}>
                        {sr.service_type} - {new Date(sr.created_at).toLocaleDateString("fa-IR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  اگر تیکت شما مربوط به یکی از پروژه‌های ثبت شده است، آن را انتخاب کنید
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-base font-semibold">
                موضوع تیکت *
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: مشکل در اجرای پروژه، سوال درباره صورتحساب و..."
                maxLength={200}
                required
                className="h-11"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  یک موضوع واضح و مختصر وارد کنید
                </p>
                <p className="text-xs text-muted-foreground">
                  {subject.length}/200
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-base font-semibold">
                پیام شما *
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="لطفاً توضیحات کامل درخواست، مشکل یا سوال خود را با جزئیات بنویسید. هر چه اطلاعات بیشتری ارائه دهید، پاسخگویی سریع‌تر و دقیق‌تر خواهد بود."
                rows={8}
                maxLength={2000}
                required
                className="resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  حداقل 20 کاراکتر نوشته شود
                </p>
                <p className="text-xs text-muted-foreground">
                  {message.length}/2000
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="files" className="text-base font-semibold">
                پیوست فایل (اختیاری)
              </Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                <input
                  type="file"
                  id="files"
                  multiple
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="files" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                      <Upload className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground mb-1">
                        کلیک کنید یا فایل‌ها را بکشید و رها کنید
                      </p>
                      <p className="text-sm text-muted-foreground">
                        فرمت‌های مجاز: تصویر، ویدیو یا PDF
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      <span>حداکثر حجم: 70 مگابایت</span>
                    </div>
                  </div>
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">فایل‌های انتخاب شده:</span>
                    <span className="text-muted-foreground">
                      {formatFileSize(totalSize)} / {formatFileSize(maxSize)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                      >
                        {file.type.startsWith("image/") ? (
                          <FileImage className="h-5 w-5 text-primary" />
                        ) : (
                          <FileVideo className="h-5 w-5 text-primary" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading || !department || !subject || !message || message.length < 20}
                className="flex-1 h-12 shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                    در حال آپلود فایل‌ها...
                  </>
                ) : loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                    در حال ثبت تیکت...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-5 w-5 ml-2" />
                    ارسال تیکت
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/tickets")}
                disabled={loading}
                size="lg"
                className="h-12"
              >
                انصراف
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewTicket;