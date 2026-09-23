// Vercel serverless function / Express API route: /api/send-email
// Dispatches inbound contact messages directly to Marvel India departmental inboxes
// using the Resend API (resend.com).
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  const { name, email, recipient, category, subject, message } = req.body || {};

  if (!subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ ok: false, error: "Subject and message are required." });
  }

  const contactEmail = process.env.CONTACT_EMAIL || "contact@marvelindia.in";
  const legalEmail = process.env.LEGAL_EMAIL || "legal@marvelindia.in";
  const targetRecipient = (recipient && recipient.includes("legal")) ? legalEmail : contactEmail;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    // Graceful fallback if RESEND_API_KEY is not yet configured in environment variables
    return res.status(200).json({
      ok: false,
      fallbackToMailto: true,
      error: "Resend API key is not configured in environment variables (RESEND_API_KEY)."
    });
  }

  const senderDomain = process.env.RESEND_FROM_EMAIL || "Marvel India Dispatch <onboarding@resend.dev>";
  const userSenderEmail = (email && email.trim()) ? email.trim() : "no-reply@marvelindia.in";

  try {
    const payload = {
      from: senderDomain,
      to: [targetRecipient],
      reply_to: userSenderEmail,
      subject: `[Marvel India: ${category || "General"}] ${subject.trim()}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #12141a; padding: 20px; border-bottom: 3px solid #e23636;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">MARVEL <span style="color: #e23636;">INDIA</span> DISPATCH</h2>
            <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Inbound Communiqué &bull; ${category || "General Inquiry"}</p>
          </div>
          <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 120px;"><strong>Sender Name:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${name ? String(name).replace(/</g, "&lt;") : "Anonymous Fan"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Reply-To:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${userSenderEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Department:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${targetRecipient}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Subject:</strong></td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${String(subject).replace(/</g, "&lt;")}</td>
              </tr>
            </table>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin-top: 14px;">
              <h4 style="margin: 0 0 10px; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Message Body</h4>
              <p style="margin: 0; white-space: pre-wrap; font-size: 15px; color: #0f172a;">${String(message).replace(/</g, "&lt;")}</p>
            </div>
          </div>
          <div style="background: #f1f5f9; padding: 14px 20px; text-align: center; font-size: 12px; color: #64748b;">
            Sent securely via Marvel India Dispatch &bull; Resend Integration
          </div>
        </div>
      `,
      text: `MARVEL INDIA INQUIRY\nSender: ${name || "Anonymous"} (${userSenderEmail})\nCategory: ${category || "General"}\nDepartment: ${targetRecipient}\nSubject: ${subject}\n\nMessage:\n${message}`
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[MarvelIndia] Resend API error:", resendData);
      return res.status(resendResponse.status).json({
        ok: false,
        error: resendData.message || "Failed to send email via Resend.",
        fallbackToMailto: true
      });
    }

    return res.status(200).json({ ok: true, id: resendData.id });
  } catch (err) {
    console.error("[MarvelIndia] Error dispatching to Resend:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error contacting Resend API.",
      fallbackToMailto: true
    });
  }
}
