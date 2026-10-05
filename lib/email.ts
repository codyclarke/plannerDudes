import nodemailer from "nodemailer";
import { APP_NAME } from "./app";

// Mail goes out through the owner's Gmail account (SMTP + an App Password),
// so it can reach any address without a verified domain. Gmail always sends
// "from" the authenticated address; only the display name is ours.

// Titles and names are user-entered; escape them so nobody can inject
// markup into everyone's inbox.
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailResult = { sent: true } | { sent: false; reason: string };

// Every send goes through here: failures are logged (visible in Vercel's
// function logs) and returned so callers can tell the user, never thrown.
async function send(message: { to: string | string[]; subject: string; html: string }): Promise<EmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { sent: false, reason: "Email isn't set up yet." };
  if (Array.isArray(message.to) && message.to.length === 0) return { sent: true };

  try {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({ from: { name: APP_NAME, address: user }, ...message });
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${message.subject}":`, err);
    const code = (err as { code?: string } | null)?.code;
    return {
      sent: false,
      reason:
        code === "EAUTH"
          ? "Gmail rejected the sign-in — check GMAIL_USER and GMAIL_APP_PASSWORD."
          : "The email couldn't be sent.",
    };
  }
}

export function sendInviteEmail(opts: { to: string; inviterName: string; inviteUrl: string }) {
  return send({
    to: opts.to,
    subject: `${opts.inviterName} invited you to ${APP_NAME}`,
    html: `<p>${esc(opts.inviterName)} invited you to join their group on ${APP_NAME}.</p>
           <p><a href="${esc(opts.inviteUrl)}">Click here to create your account</a></p>`,
  });
}

export function sendEventCreatedEmail(opts: {
  to: string[];
  organizerName: string;
  title: string;
  eventUrl: string;
}) {
  return send({
    to: opts.to,
    subject: `New event: ${opts.title}`,
    html: `<p>${esc(opts.organizerName)} proposed a new event: <strong>${esc(opts.title)}</strong>.</p>
           <p><a href="${esc(opts.eventUrl)}">Vote on a time</a></p>`,
  });
}

export function sendEventFinalizedEmail(opts: {
  to: string[];
  title: string;
  whenText: string;
  eventUrl: string;
}) {
  return send({
    to: opts.to,
    subject: `Time locked in: ${opts.title}`,
    html: `<p><strong>${esc(opts.title)}</strong> is happening ${esc(opts.whenText)}.</p>
           <p><a href="${esc(opts.eventUrl)}">View event &amp; add to your calendar</a></p>`,
  });
}

export function sendEventReminderEmail(opts: {
  to: string[];
  title: string;
  whenText: string;
  eventUrl: string;
}) {
  return send({
    to: opts.to,
    subject: `Reminder: ${opts.title} is coming up`,
    html: `<p><strong>${esc(opts.title)}</strong> is ${esc(opts.whenText)}.</p>
           <p><a href="${esc(opts.eventUrl)}">View event</a></p>`,
  });
}
