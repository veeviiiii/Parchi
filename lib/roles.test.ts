import { describe, expect, it } from "vitest";
import { canPost, canRead, isRole, postableSpaces, type Role } from "./roles";

describe("Crowdmind access matrix", () => {
  it("lets each role read only its own space", () => {
    const roles: Role[] = ["consumer", "community", "merchant"];
    for (const role of roles) {
      for (const space of roles) {
        expect(canRead(role, space)).toBe(role === space);
      }
    }
  });

  it("follows the posting table", () => {
    // Buyers' space: everyone can post.
    expect(canPost("consumer", "consumer")).toBe(true);
    expect(canPost("community", "consumer")).toBe(true);
    expect(canPost("merchant", "consumer")).toBe(true);
    // Communities' space: communities and merchants.
    expect(canPost("community", "community")).toBe(true);
    expect(canPost("merchant", "community")).toBe(true);
    expect(canPost("consumer", "community")).toBe(false);
    // Merchants' space: merchants and communities.
    expect(canPost("merchant", "merchant")).toBe(true);
    expect(canPost("community", "merchant")).toBe(true);
    expect(canPost("consumer", "merchant")).toBe(false);
  });

  it("lists the spaces each role can post into, own space first", () => {
    expect(postableSpaces("consumer")).toEqual(["consumer"]);
    expect(postableSpaces("community")).toEqual(["community", "consumer", "merchant"]);
    expect(postableSpaces("merchant")).toEqual(["merchant", "consumer", "community"]);
  });

  it("recognises only the three roles", () => {
    expect(isRole("merchant")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
