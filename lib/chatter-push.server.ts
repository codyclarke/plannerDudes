import { sendPushToProfiles } from "./push";

/** Ordinary chat messages only show badges; @mentions push right away. */
export async function notifyMentions({
  mentionedIds,
  authorName,
  eventTitle,
  body,
  eventUrl,
}: {
  mentionedIds: string[];
  authorName: string;
  eventTitle: string;
  body: string;
  eventUrl: string;
}) {
  const snippet = body.length > 120 ? `${body.slice(0, 117).trimEnd()}…` : body;
  await sendPushToProfiles(mentionedIds, {
    title: `💬 ${authorName} mentioned you in ${eventTitle}`,
    body: snippet,
    url: eventUrl,
  });
}
