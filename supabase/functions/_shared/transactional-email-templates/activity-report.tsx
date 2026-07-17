/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  eventType?: string
  title?: string
  actorName?: string
  actorPhone?: string
  occurredAt?: string
  details?: Record<string, any>
}

const labelFor = (k: string) => {
  const map: Record<string, string> = {
    eventType: 'نوع رویداد',
    actorName: 'انجام‌دهنده',
    actorPhone: 'تلفن',
    occurredAt: 'زمان',
    orderId: 'شناسه سفارش',
    customerName: 'مشتری',
    customerPhone: 'تلفن مشتری',
    status: 'وضعیت',
    previousStatus: 'وضعیت قبلی',
    newStatus: 'وضعیت جدید',
    amount: 'مبلغ',
    cardName: 'کارت بانکی',
    moduleName: 'ماژول',
    reportDate: 'تاریخ گزارش',
    staffCount: 'تعداد نیرو',
    note: 'توضیحات',
    askedBy: 'پرسیده شده توسط',
    question: 'پرسش',
  }
  return map[k] || k
}

const ActivityReport = ({
  eventType = 'رویداد',
  title = 'گزارش فعالیت',
  actorName,
  actorPhone,
  occurredAt,
  details = {},
}: Props) => (
  <Html lang="fa" dir="rtl">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title}</Heading>
        <Text style={subtitle}>نوع رویداد: <strong>{eventType}</strong></Text>
        {occurredAt && <Text style={meta}>زمان: {occurredAt}</Text>}
        {(actorName || actorPhone) && (
          <Text style={meta}>
            انجام‌دهنده: {actorName || '—'} {actorPhone ? `(${actorPhone})` : ''}
          </Text>
        )}
        <Hr style={hr} />
        <Section>
          {Object.entries(details).map(([k, v]) => (
            <Text key={k} style={row}>
              <strong>{labelFor(k)}:</strong>{' '}
              {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '—')}
            </Text>
          ))}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>این پیام به‌صورت خودکار از سامانه‌ی آهرم ارسال شده است.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ActivityReport,
  subject: (data: Record<string, any>) =>
    `[آهرم] ${data?.title || data?.eventType || 'گزارش فعالیت'}`,
  displayName: 'گزارش فعالیت',
  to: 'ahrom.com@gmail.com',
  previewData: {
    eventType: 'ثبت سفارش جدید',
    title: 'سفارش جدید ثبت شد',
    actorName: 'علی رضایی',
    actorPhone: '09120000000',
    occurredAt: new Date().toISOString(),
    details: { orderId: 'ORD-123', customerName: 'علی رضایی', amount: '۵٬۰۰۰٬۰۰۰ تومان' },
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '20px', color: 'hsl(222, 47%, 11%)', margin: '0 0 8px' }
const subtitle = { fontSize: '14px', color: '#111', margin: '4px 0' }
const meta = { fontSize: '13px', color: '#444', margin: '2px 0' }
const row = { fontSize: '13px', color: '#222', margin: '6px 0', lineHeight: '1.7' }
const hr = { borderColor: '#eee', margin: '16px 0' }
const footer = { fontSize: '11px', color: '#888', margin: '8px 0 0' }
