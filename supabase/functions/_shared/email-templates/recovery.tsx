/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="fa" dir="rtl">
    <Head />
    <Preview>بازیابی رمز عبور {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>بازیابی رمز عبور</Heading>
        <Text style={text}>
          درخواست بازیابی رمز عبور برای حساب شما در {siteName} دریافت شد.
          برای انتخاب رمز جدید، روی دکمه‌ی زیر کلیک کنید.
        </Text>
        <Button style={button} href={confirmationUrl}>
          تغییر رمز عبور
        </Button>
        <Text style={footer}>
          اگر شما این درخواست را ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید؛
          رمز عبور شما تغییر نخواهد کرد.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 35%)', lineHeight: '1.8', margin: '0 0 20px' }
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
