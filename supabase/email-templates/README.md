# Supabase 6-Digit OTP Email Templates & SMTP Setup

These email templates match Marvel India's comic book print identity and are configured to send 6-digit OTP codes via your custom SMTP provider (e.g. SendGrid, Resend, Amazon SES, Brevo, Gmail SMTP).

## 1. Configure Custom SMTP in Supabase
1. Go to your **Supabase Dashboard** -> Project Settings -> **Authentication**.
2. Scroll to **SMTP Settings** and enable **Enable Custom SMTP**.
3. Fill in your SMTP credentials:
   - **Sender email**: `noreply@yourdomain.com` or your verified address
   - **Sender name**: `Marvel India`
   - **Host, Port, Username, Password**: (from your SMTP provider)

## 2. Configure OTP Verification Length
1. In **Authentication -> Providers -> Email**:
   - Ensure **Confirm email** is enabled.
   - Set **Mailer OTP Expire in seconds**: `600` (10 minutes) or your preference.
   - Supabase defaults to generating 6-digit OTP codes when `{{ .Token }}` is used in templates.

## 3. Apply the Email Templates
1. In **Authentication -> Email Templates**:
2. **Confirm signup**:
   - **Subject**: `Your Marvel India Verification Code: {{ .Token }}`
   - **Body**: Paste the contents of `supabase/email-templates/confirm-signup.html`
3. **Magic Link / Sign In With OTP**:
   - **Subject**: `Your Marvel India Sign-In Code: {{ .Token }}`
   - **Body**: Paste the contents of `supabase/email-templates/magic-link.html`
4. Click **Save** on both templates.

Users will now receive the responsive comic-styled Marvel India email containing their 6-digit verification code.
