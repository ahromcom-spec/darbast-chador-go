import { template as activityReport } from './activity-report.tsx'

export interface TemplateEntry {
  component: any
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'activity-report': activityReport,
}
