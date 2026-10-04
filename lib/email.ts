import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "Friend Events <onboarding@resend.dev>";

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

export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  inviteUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) return; // not configured yet in local dev
  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `${opts.inviterName} invited you to Friend Events`,
    html: `<p>${esc(opts.inviterName)} invited you to join their group on Friend Events.</p>
           <p><a href="${esc(opts.inviteUrl)}">Click here to create your account</a></p>`,
  });
}

export async function sendEventCreatedEmail(opts: {
  to: string[];
  organizerName: string;
  title: string;
  eventUrl: string;
}) {
  if (!process.env.RESEND_API_KEY || opts.to.length === 0) return;
  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `New event: ${opts.title}`,
    html: `<p>${esc(opts.organizerName)} proposed a new event: <strong>${esc(opts.title)}</strong>.</p>
           <p><a href="${esc(opts.eventUrl)}">Vote on a time</a></p>`,
  });
}

export async function sendEventFinalizedEmail(opts: {
  to: string[];
  title: string;
  whenText: string;
  eventUrl: string;
}) {
  if (!process.env.RESEND_API_KEY || opts.to.length === 0) return;
  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Time locked in: ${opts.title}`,
    html: `<p><strong>${esc(opts.title)}</strong> is happening ${esc(opts.whenText)}.</p>
           <p><a href="${esc(opts.eventUrl)}">View event &amp; add to your calendar</a></p>`,
  });
}

export async function sendEventReminderEmail(opts: {
  to: string[];
  title: string;
  whenText: string;
  eventUrl: string;
}) {
  if (!process.env.RESEND_API_KEY || opts.to.length === 0) return;
  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Reminder: ${opts.title} is coming up`,
    html: `<p><strong>${esc(opts.title)}</strong> is ${esc(opts.whenText)}.</p>
           <p><a href="${esc(opts.eventUrl)}">View event</a></p>`,
  });
}
