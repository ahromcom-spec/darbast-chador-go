import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, FileImage, FileVideo, MessageSquare, XCircle } from "lucide-react";

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

interface TicketFormProps {
  userId: string;
  onSuccess?: () => void;
}

export function TicketForm({ userId, onSuccess }: TicketFormProps) {
  const [department, setDepartment] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchServiceRequests();
  }, []);

  const fetchServiceRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_type, created_at")
        .eq("user_id", userId)
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
    const maxSize = 70 * 1024 * 1024;

    if (totalSize > maxSize) {
      toast.error("حجم کل فایل‌ها نباید بیشتر از 70 مگابایت باشد");
      return;
    }

    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async (ticketId: string) => {
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
      toast.error("لطفاً تمام فیلدهای ضروری را پر کنید");
      return;
    }

    if (subject.trim().length < 5) {
      toast.error("موضوع تیکت باید حداقل 5 کاراکتر باشد");
      return;
    }

    if (message.trim().length < 20) {
      toast.error("پیام شما باید حداقل 20 کاراکتر باشد");
      return;
    }

    setLoading(true);
    setUploading(files.length > 0);

    try {
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          user_id: userId,
          department,
          subject,
          message,
          service_request_id: serviceRequestId
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (files.length > 0) {
        await uploadFiles(ticket.id);
      }

      toast.success("تیکت با موفقیت ثبت شد");
      
      // Reset form
      setDepartment("");
      setServiceRequestId(null);
      setSubject("");
      setMessage("");
      setFiles([]);

      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || "خطا در ثبت تیکت");
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>ایجاد تیکت جدید</CardTitle>
            <CardDescription>
              برای ارتباط با بخش‌های مختلف، تیکت خود را ثبت کنید
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department">بخش مورد نظر *</Label>
            <Select value={department} onValueChange={setDepartment} required>
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
              <Label htmlFor="serviceRequest">پروژه مرتبط (اختیاری)</Label>
              <Select
                value={serviceRequestId ?? undefined}
                onValueChange={(v) => setServiceRequestId(v === NONE_VALUE ? null : v)}
              >
                <SelectTrigger id="serviceRequest">
                  <SelectValue placeholder="انتخاب پروژه..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <XCircle className="h-4 w-4" />
                      بدون پروژه
                    </div>
                  </SelectItem>
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
              placeholder="موضوع تیکت را وارد کنید..."
              maxLength={200}
              required
            />
            <p className="text-xs text-muted-foreground text-left">
              {subject.length}/200
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">پیام شما *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="توضیحات کامل را وارد کنید..."
              rows={6}
              maxLength={2000}
              required
            />
            <p className="text-xs text-muted-foreground text-left">
              {message.length}/2000
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="files">پیوست فایل (اختیاری)</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
              <input
                type="file"
                id="files"
                multiple
                accept="image/*,video/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="files" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-primary" />
                  <p className="text-sm">کلیک کنید یا فایل را بکشید</p>
                  <p className="text-xs text-muted-foreground">حداکثر 70 مگابایت</p>
                </div>
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>فایل‌های انتخاب شده:</span>
                  <span className="text-muted-foreground">
                    {formatFileSize(totalSize)} / {formatFileSize(maxSize)}
                  </span>
                </div>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    {file.type.startsWith("image/") ? (
                      <FileImage className="h-4 w-4" />
                    ) : (
                      <FileVideo className="h-4 w-4" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{file.name}</p>
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
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !department || !subject || !message}
            className="w-full"
          >
            {uploading ? (
              <>در حال آپلود...</>
            ) : loading ? (
              <>در حال ثبت...</>
            ) : (
              <>ارسال تیکت</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}