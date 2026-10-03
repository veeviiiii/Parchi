// Turns pasted chat text into a list of messages (CLAUDE.md section 10).
// Plain code only: no AI here.

export type ChatMessage = {
  id: string;
  sender: string;
  time: string;
  text: string;
};

// Pieces of a WhatsApp timestamp, e.g. "03/10/26" or "03/10", and "9:02 pm" or "21:02:11".
const DATE = String.raw`\d{1,4}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?`;
const TIME = String.raw`\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[ap]\.?\s?m\.?)?`;

// iOS export or short pasted format: "[03/10/26, 9:02:11 PM] Rahul: text"
const BRACKET_LINE = new RegExp(`^\\[(${DATE}),?\\s+(${TIME})\\]\\s*(.*)$`, "i");
// Android export: "03/10/26, 9:02 pm - Rahul: text"
const ANDROID_LINE = new RegExp(`^(${DATE}),?\\s+(${TIME})\\s+[-–]\\s+(.*)$`, "i");
// "Rahul: text" (what's left after the timestamp, or a plain pasted line)
const SENDER_AND_TEXT = /^([^:]{1,40}):(?:\s+|$)(.*)$/;

// A name in a WhatsApp system line: "Rahul", "Rahul Sharma", "+91 98765 43210", or "You".
// Capitalised on purpose, so "pen removed kar do" is NOT treated as a system line.
const NAME = String.raw`(?:[A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,3}|\+[\d ]{6,20}|You|you)`;
const NAMES = String.raw`${NAME}(?:(?:, | and )${NAME})*`;

// WhatsApp lines that are not real messages.
const SYSTEM_TEXT = [
  /messages and calls are end-to-end encrypted/i,
  /^<media omitted>$/i,
  /^(image|video|audio|sticker|gif|document|contact card) omitted$/i,
  /^<attached: .+>$/i,
  /^(this message was deleted|you deleted this message)\.?$/i,
  / joined using this group's invite link$/i,
  new RegExp(`^${NAME} (joined|left)$`),
  new RegExp(`^${NAME} (added|removed) ${NAMES}$`),
  new RegExp(`^${NAME} (created group|changed the subject|changed this group's icon|changed the group description)`),
];

const EDITED_TAG = /\s*<this message was edited>$/i;

// Removes the invisible characters real exports contain.
function cleanInvisible(text: string): string {
  return text
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, "") // direction marks (iOS), BOM
    .replace(/[  ]/g, " "); // narrow / no-break spaces (Android puts one before "pm")
}

function isSystemText(text: string): boolean {
  return SYSTEM_TEXT.some((pattern) => pattern.test(text));
}

type LineStart = { sender: string; time: string; text: string } | "system" | null;

// Does this line start a new message? Returns the message, "system", or null (continuation).
function readTimestampedLine(line: string): LineStart {
  const match = BRACKET_LINE.exec(line) ?? ANDROID_LINE.exec(line);
  if (!match) return null;
  const time = match[2].toLowerCase();
  const rest = SENDER_AND_TEXT.exec(match[3]);
  // A timestamp with no "Name:" is a system line, e.g. "Rahul added Priya".
  if (!rest) return "system";
  return { sender: rest[1].trim(), time, text: rest[2] };
}

function readPlainLine(line: string): LineStart {
  const match = SENDER_AND_TEXT.exec(line);
  return match ? { sender: match[1].trim(), time: "", text: match[2] } : null;
}

export function parseChat(raw: string): ChatMessage[] {
  const lines = cleanInvisible(raw).split(/\r?\n/);

  // If any line has a WhatsApp timestamp, only timestamped lines start messages.
  // Otherwise fall back to plain "Name: text" lines.
  const hasTimestamps = lines.some((line) => BRACKET_LINE.test(line) || ANDROID_LINE.test(line));
  const readLine = hasTimestamps ? readTimestampedLine : readPlainLine;

  const drafts: { sender: string; time: string; lines: string[] }[] = [];
  let current: (typeof drafts)[number] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const start = readLine(line);
    if (start === "system") {
      current = null;
    } else if (start) {
      current = { sender: start.sender, time: start.time, lines: [start.text] };
      drafts.push(current);
    } else if (current && line) {
      current.lines.push(line); // continues the previous message
    }
  }

  return drafts
    .map((draft) => ({
      sender: draft.sender,
      time: draft.time,
      text: draft.lines.join("\n").replace(EDITED_TAG, "").trim(),
    }))
    .filter((message) => message.text && !isSystemText(message.text))
    .map((message, index) => ({ id: `m${index + 1}`, ...message }));
}
