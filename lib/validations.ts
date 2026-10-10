import { z } from "zod";

/** Most candidate dates a poll can have (the create form uses this too). */
export const MAX_DATE_OPTIONS = 8;

export const signupSchema = z.object({
  token: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(100),
});

export const createInviteSchema = z.object({
  email: z.string().trim().email(),
});

// A candidate is either a specific time (UTC ISO, converted client-side from
// the browser's zone) or a whole day ("YYYY-MM-DD", no timezone involved).
export const eventOptionInput = z.union([
  z.object({
    allDay: z.literal(false),
    startsAt: z.iso.datetime(),
    label: z.string().trim().max(80).optional(),
  }),
  z.object({
    allDay: z.literal(true),
    date: z.iso.date(),
    label: z.string().trim().max(80).optional(),
  }),
]);

/** Event details shared by create and edit. */
const eventDetailsFields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  emoji: z.string().trim().min(1).max(16).optional(),
  spousesInvited: z.boolean(),
  kidsAllowed: z.boolean(),
};

/** Organizer (or app owner) edits an event's details. */
export const editEventSchema = z.object(eventDetailsFields);

/** Organizer adds a candidate date to a poll. */
export const addOptionSchema = z.object({ option: eventOptionInput });

export const createEventSchema = z
  .object({
    ...eventDetailsFields,
    imagePath: z.string().max(200).optional(), // ownership checked in the route
    // true = "set date" event: exactly one date, created already locked in.
    fixedDate: z.boolean().default(false),
    votingClosesAt: z.iso.datetime().optional(), // end of the chosen day, converted client-side
    options: z.array(eventOptionInput).min(1).max(MAX_DATE_OPTIONS),
  })
  .refine((e) => (e.fixedDate ? e.options.length === 1 : e.options.length >= 2), {
    message: "A set-date event has exactly one date; a vote needs at least two.",
    path: ["options"],
  })
  .refine((e) => !(e.fixedDate && e.votingClosesAt), {
    message: "Set-date events don't have a voting deadline.",
    path: ["votingClosesAt"],
  });

/** Organizer moves a set-date event (same shape as one create option). */
export const changeEventDateSchema = z.object({ date: eventOptionInput });

export const updateVotingCloseSchema = z.object({
  votingClosesAt: z.iso.datetime().nullable(), // null removes the deadline
});

export const voteSchema = z.object({
  eventOptionId: z.string().uuid(),
  response: z.enum(["yes", "maybe", "no"]),
  adultsCount: z.number().int().min(0).max(20),
  kidsCount: z.number().int().min(0).max(20),
});

export const voteBatchSchema = z.object({
  votes: z.array(voteSchema).min(1),
});

export const updateEventImageSchema = z.object({
  imagePath: z.string().max(200).nullable(), // null removes the cover
});

export const updateAvatarSchema = z.object({
  avatarPath: z.string().max(200).nullable(), // null removes the photo
});

export const finalizeSchema = z.object({
  eventOptionId: z.string().uuid(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// --- Places to stay -------------------------------------------------------

/** Most links one paste can add. */
export const MAX_LINKS_PER_PASTE = 10;

export const addPlacesSchema = z.object({
  urls: z.array(z.string().trim().min(1).max(2000)).min(1).max(MAX_LINKS_PER_PASTE),
});

export const renamePlaceSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const placeVoteSchema = z.object({
  response: z.enum(["yes", "maybe", "no"]),
});

export const choosePlaceSchema = z.object({
  placeId: z.string().uuid().nullable(), // null un-picks
});
