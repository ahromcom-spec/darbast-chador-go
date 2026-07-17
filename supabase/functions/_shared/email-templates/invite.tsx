/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="fa" dir="rtl">
    <Head />
    <Preview>دعوت به همکاری در {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>به {siteName} دعوت شدید</Heading>
        <Text style={text}>
          شما برای پیوستن به{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>
          {' '}دعوت شده‌اید. برای پذیرش دعوت و ساخت حساب کاربری، روی دکمه‌ی زیر کلیک کنید.
        </Text>
        <Button style={button} href={confirmationUrl}>
          پذیرش دعوت
        </Button>
        <Text style={footer}>
          اگر این دعوت را انتظار نداشته‌اید، می‌توانید این ایمیل را نادیده بگیرید.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 35%)', lineHeight: '1.8', margin: '0 0 20px' }
const link = { color: 'hsl(215, 85%, 25%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(215, 85%, 25%)',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#888888', margin: '32px 0 0', lineHeight: '1.6' }
