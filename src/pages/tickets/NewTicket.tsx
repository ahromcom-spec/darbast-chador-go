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
import { ArrowRight, Upload, X, FileImage, FileVideo } from "lucide-react";

interface ServiceRequest {
  id: string;
  service_type: string;
  created_at: string;
}

const departments = [
  { value: "order", label: "ثبت سفارش" },
  { value: "execution", label: "اجرایی" },
  { value: "support", label: "پشتیبانی" },
  { value: "financial", label: "مالی" },
  { value: "management", label: "مدیریت" }
];

const NewTicket = () => {
  const [department, setDepartment] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState<string>("");
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
        title: "خطا",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
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
          service_request_id: serviceRequestId || null
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (files.length > 0) {
        await uploadFiles(ticket.id, user.id);
      }

      toast({
        title: "تیکت ثبت شد",
        description: "تیکت شما با موفقیت ثبت شد و به زودی بررسی خواهد شد"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">ایجاد تیکت جدید</CardTitle>
          <CardDescription>
            برای ارتباط با بخش‌های مختلف، تیکت خود را ثبت کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="department">بخش مورد نظر *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="انتخاب بخش..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {serviceRequests.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="serviceRequest">پروژه/سفارش مرتبط (اختیاری)</Label>
                <Select value={serviceRequestId} onValueChange={setServiceRequestId}>
                  <SelectTrigger id="serviceRequest">
                    <SelectValue placeholder="انتخاب پروژه..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون انتخاب</SelectItem>
                    {serviceRequests.map((sr) => (
                      <SelectItem key={sr.id} value={sr.id}>
                        {sr.service_type} - {new Date(sr.created_at).toLocaleDateString("fa-IR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">موضوع تیکت *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="خلاصه‌ای از موضوع تیکت..."
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">پیام شما *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="توضیحات کامل درخواست یا مشکل خود را بنویسید..."
                rows={6}
                maxLength={2000}
              />
              <p className="text-sm text-muted-foreground text-left">
                {message.length}/2000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">پیوست فایل (عکس یا فیلم)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="files"
                  multiple
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="files" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    کلیک کنید یا فایل‌ها را بکشید و رها کنید
                  </p>
                  <p className="text-xs text-muted-foreground">
                    حداکثر 70 مگابایت برای تمام فایل‌ها
                  </p>
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

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
                size="lg"
              >
                {uploading ? "در حال آپلود فایل‌ها..." : loading ? "در حال ثبت..." : "ثبت تیکت"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/tickets")}
                disabled={loading}
                size="lg"
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