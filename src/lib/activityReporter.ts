import { supabase } from '@/integrations/supabase/client';

export interface ReportActivityInput {
  eventType?: string;
  eventCategory?: string;
  action?: string;
  moduleName?: string | null;
  entityTable?: string | null;
  entityId?: string | null;
  title: string;
  details?: Record<string, any>;
}

// Friendly Persian labels for known module keys
const MODULE_KEY_LABELS: Record<string, string> = {
  daily_report: 'گزارش روزانه شرکت اهرم',
  daily_report_executive: 'گزارش روزانه اجرایی اهرم',
  daily_report_management: 'گزارش روزانه مدیریت اهرم',
  daily_report_support: 'گزارش روزانه پشتیبانی اهرم',
  daily_report_full: 'گزارش روزانه کلی اهرم',
  daily_report_all: 'گزارش روزانه کلی اهرم',
  daily_report_total: 'گزارش روزانه کلی اهرم',
  activity_logs: 'لاگ فعالیت‌ها',
};

function friendlyModuleName(key: string | null | undefined): string | null {
  if (!key) return null;
  return MODULE_KEY_LABELS[key] || key;
}

/**
 * Direct activity logger. Writes to public.activity_logs via the Data API
 * (so the row appears in the CEO activity log table immediately) and then
 * fires a push notification to the CEO in the background.
 */
export async function reportActivity(input: ReportActivityInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let actorName: string | null = null;
    let actorPhone: string | null = null;
    if (user?.id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', user.id)
        .maybeSingle();
      actorName = prof?.full_name || null;
      actorPhone = prof?.phone_number || null;
    }

    const moduleLabel = friendlyModuleName(input.moduleName);

    // 1) Direct insert into activity_logs (reliable, doesn't depend on edge func)
    const { error: insertErr } = await supabase.from('activity_logs').insert({
      event_type: input.eventType || 'module_edit',
      event_category: input.eventCategory || 'module',
      action: input.action || 'update',
      module_name: moduleLabel,
      entity_table: input.entityTable ?? null,
      entity_id: input.entityId ?? null,
      title: input.title,
      details: input.details || {},
      actor_user_id: user?.id || null,
      actor_name: actorName,
      actor_phone: actorPhone,
    });

    if (insertErr) {
      console.debug('[reportActivity] direct insert failed', insertErr);
    }

    // 2) Fire-and-forget push to CEO
    const pushBodyParts: string[] = [];
    if (actorName) pushBodyParts.push(actorName);
    if (actorPhone) pushBodyParts.push(actorPhone);
    if (moduleLabel) pushBodyParts.push(moduleLabel);
    const pushBody = pushBodyParts.join(' • ') || input.action || 'رویداد جدید در سایت اهرم';

    supabase.functions
      .invoke('send-onesignal-push', {
        body: {
          title: input.title,
          body: pushBody,
          url: '/activity-logs',
          phone: '09125511494',
        },
      })
      .catch((e) => console.debug('[reportActivity] push failed', e));
  } catch (e) {
    console.debug('[reportActivity] error', e);
  }
}
