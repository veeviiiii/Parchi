import { describe, expect, it } from "vitest";
import { parseChat } from "./parseChat";
import { SAMPLE_CHAT } from "./sampleChat";

const LRM = "‎"; // invisible direction mark (iOS)
const NNBSP = " "; // narrow no-break space (newer Android and iOS, before "pm")

describe("parseChat", () => {
  it("reads the short pasted format (the sample chat)", () => {
    const messages = parseChat(SAMPLE_CHAT);
    expect(messages).toHaveLength(7);
    expect(messages[0]).toEqual({
      id: "m1",
      sender: "Rahul",
      time: "9:02 pm",
      text: "bhai 2 copy chahiye single line wali",
    });
    expect(messages.map((m) => m.sender)).toEqual(["Rahul", "Priya", "Aman", "Sneha", "Karan", "Rahul", "Neha"]);
    expect(messages[3].text).toBe("ok 👍");
    expect(messages[6]).toMatchObject({ id: "m7", text: "2 A4 sheet packet pls" });
  });

  it("reads an Android export and skips system lines", () => {
    const chat = [
      "03/10/26, 8:58 pm - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.",
      '03/10/26, 8:59 pm - Rahul created group "Hostel B-block"',
      "03/10/26, 9:00 pm - Rahul added Priya",
      "03/10/26, 9:01 pm - Aman joined using this group's invite link",
      `03/10/26, 9:02${NNBSP}pm - Rahul: bhai 2 copy chahiye`,
      "single line wali",
      "03/10/26, 9:03 pm - Priya: <Media omitted>",
      "03/10/26, 9:04 pm - Priya: This message was deleted",
      `03/10/26, 9:05${NNBSP}pm - Aman: 3 blue gel pens <This message was edited>`,
      "03/10/26, 9:06 pm - Neha left",
    ].join("\n");

    expect(parseChat(chat)).toEqual([
      { id: "m1", sender: "Rahul", time: "9:02 pm", text: "bhai 2 copy chahiye\nsingle line wali" },
      { id: "m2", sender: "Aman", time: "9:05 pm", text: "3 blue gel pens" },
    ]);
  });

  it("reads a 24-hour Android export", () => {
    expect(parseChat("03/10/2026, 21:02 - Rahul: 2 pens")).toEqual([
      { id: "m1", sender: "Rahul", time: "21:02", text: "2 pens" },
    ]);
  });

  it("reads an iOS export with invisible characters and skips system lines", () => {
    const chat = [
      `${LRM}[03/10/26, 8:58:01 PM] Hostel B-block: ${LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`,
      `${LRM}[03/10/26, 9:00:00 PM] Hostel B-block: ${LRM}Rahul added Priya and Aman`,
      `[03/10/26, 9:02:11${NNBSP}PM] Rahul: bhai 2 copy chahiye`,
      "single line wali",
      `${LRM}[03/10/26, 9:03:00 PM] Priya: ${LRM}image omitted`,
      `[03/10/26, 9:04:30 PM] Priya: ${LRM}This message was deleted.`,
      "[03/10/26, 9:05:45 PM] Aman: 1 geometry box",
      `${LRM}[03/10/26, 9:06:00 PM] Hostel B-block: ${LRM}Neha left`,
    ].join("\n");

    expect(parseChat(chat)).toEqual([
      { id: "m1", sender: "Rahul", time: "9:02:11 pm", text: "bhai 2 copy chahiye\nsingle line wali" },
      { id: "m2", sender: "Aman", time: "9:05:45 pm", text: "1 geometry box" },
    ]);
  });

  it("falls back to plain 'Name: text' lines", () => {
    const chat = "Rahul: 2 copy chahiye\nPriya: some pens\nfor me\nAman: 1 geometry box";
    expect(parseChat(chat)).toEqual([
      { id: "m1", sender: "Rahul", time: "", text: "2 copy chahiye" },
      { id: "m2", sender: "Priya", time: "", text: "some pens\nfor me" },
      { id: "m3", sender: "Aman", time: "", text: "1 geometry box" },
    ]);
  });

  it("keeps a continuation line that contains a colon", () => {
    const chat = "[03/10, 9:02 pm] Rahul: 2 pens\nnote: blue wale\n[03/10, 9:03 pm] Priya: ok";
    expect(parseChat(chat).map((m) => m.text)).toEqual(["2 pens\nnote: blue wale", "ok"]);
  });

  it("handles Windows line endings and a byte-order mark", () => {
    const chat = "﻿[03/10, 9:02 pm] Rahul: 2 pens\r\n[03/10, 9:03 pm] Priya: 1 eraser\r\n";
    expect(parseChat(chat).map((m) => [m.sender, m.text])).toEqual([
      ["Rahul", "2 pens"],
      ["Priya", "1 eraser"],
    ]);
  });

  it("does not mistake real messages for system lines", () => {
    const chat = [
      "[03/10, 9:02 pm] Karan: pen removed kar do",
      "[03/10, 9:03 pm] Priya: only 2 left",
      "[03/10, 9:04 pm] Aman: maine list mein added kar diya",
    ].join("\n");
    expect(parseChat(chat)).toHaveLength(3);
  });

  it("returns nothing for empty input", () => {
    expect(parseChat("")).toEqual([]);
    expect(parseChat("   \n  ")).toEqual([]);
  });
});
