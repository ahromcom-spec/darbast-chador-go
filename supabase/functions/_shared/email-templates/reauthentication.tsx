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
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fa" dir="rtl">
    <Head />
    <Preview>کد تایید شما</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>تایید هویت</Heading>
        <Text style={text}>برای تایید هویت خود، کد زیر را وارد کنید:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          اعتبار این کد کوتاه است. اگر این درخواست از طرف شما نبوده، می‌توانید این ایمیل را نادیده بگیرید.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 35%)', lineHeight: '1.8', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(215, 85%, 25%)',
  letterSpacing: '4px',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#888888', margin: '32px 0 0', lineHeight: '1.6' }
