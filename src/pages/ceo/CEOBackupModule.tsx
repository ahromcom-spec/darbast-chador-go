import BackupPanel from '@/components/backup/BackupPanel';
import CEOPhoneOnly from '@/components/backup/CEOPhoneOnly';

export default function CEOBackupModule() {
  return (
    <CEOPhoneOnly>
      <div className="container mx-auto max-w-3xl py-6 px-4 space-y-4" dir="rtl">
        <h1 className="text-2xl font-bold">بکاپ کامل دیتابیس</h1>
        <BackupPanel
          scope="full"
          title="بکاپ کامل (تمام جداول)"
          description="یک نسخه کامل از کل داده‌های شرکت و رسانه‌های آپلود شده. فقط برای مدیرعامل قابل استفاده است."
        />
        <BackupPanel
          scope="user"
          title="بکاپ شخصی"
          description="فقط داده‌های قابل دسترس کاربر فعلی."
        />
      </div>
    </CEOPhoneOnly>
  );
}
