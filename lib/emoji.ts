export const EMOJI_CHOICES = [
  "🎉", "🍔", "🍕", "🍻", "🍷", "☕", "🎂", "🎲",
  "🎮", "🎬", "🎤", "⚽", "🏈", "⛳", "🥾", "🏖️",
  "⛺", "🎣", "🎄", "🎃", "👶", "💍", "🏠", "✈️",
];

const KEYWORDS: [RegExp, string][] = [
  [/bbq|barbecue|grill|cookout|burger/i, "🍔"],
  [/pizza/i, "🍕"],
  [/beer|brew|drinks?|bar\b|pub|happy hour/i, "🍻"],
  [/wine|vineyard/i, "🍷"],
  [/coffee|brunch|breakfast/i, "☕"],
  [/birthday|bday|\b\d{1,3}(st|nd|rd|th)\b/i, "🎂"], // also "Sam's 30th"
  [/board ?game|game night|poker|cards/i, "🎲"],
  [/video ?game|gaming|lan/i, "🎮"],
  [/movie|film|cinema/i, "🎬"],
  [/karaoke|concert|music|show/i, "🎤"],
  [/soccer|football match/i, "⚽"],
  [/football|super ?bowl|nfl/i, "🏈"],
  [/golf/i, "⛳"],
  [/hike|hiking|trail/i, "🥾"],
  [/beach|lake|pool|swim/i, "🏖️"],
  [/camp/i, "⛺"],
  [/fish/i, "🎣"],
  [/christmas|holiday/i, "🎄"],
  [/halloween/i, "🎃"],
  [/baby|shower/i, "👶"],
  [/wedding|engagement/i, "💍"],
  [/housewarming|house/i, "🏠"],
  [/trip|travel|vacation/i, "✈️"],
  [/dinner|lunch|food|eat|potluck/i, "🍽️"],
];

/** Emoji for an event: the organizer's pick, else a guess from the title. */
export function eventEmoji(title: string, chosen?: string | null) {
  if (chosen) return chosen;
  return KEYWORDS.find(([re]) => re.test(title))?.[1] ?? "🎉";
}
