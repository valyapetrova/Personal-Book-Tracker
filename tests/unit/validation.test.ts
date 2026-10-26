import { describe, expect, it } from "vitest";

import { BOOKCASE_SHELVES, getShelfInfo, isShelfId, SHELF_IDS } from "@/lib/shelves";
import { firstParam, parsePositiveInt } from "@/lib/validation";

describe("parsePositiveInt", () => {
  it.each([
    [42, 42],
    ["42", 42],
    [" 7 ", 7],
  ])("accepts %j", (input, expected) => {
    expect(parsePositiveInt(input)).toBe(expected);
  });

  it.each([0, -3, 1.5, "1.5", "12abc", "1; DROP TABLE books", "", null, undefined, {}, Number.NaN, "9999999999"])(
    "rejects %j",
    (input) => {
      expect(parsePositiveInt(input)).toBeNull();
    },
  );
});

describe("firstParam", () => {
  it("uses the first of repeated search params", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("shelves", () => {
  it("knows the four shelves, and the bookcase holds all but DNF", () => {
    expect(SHELF_IDS).toEqual(["want-to-read", "reading", "finished", "dnf"]);
    expect(BOOKCASE_SHELVES.map((shelf) => shelf.id)).toEqual(["want-to-read", "reading", "finished"]);
  });

  it("validates shelf ids coming from the network", () => {
    expect(isShelfId("reading")).toBe(true);
    expect(isShelfId("favorites")).toBe(false);
    expect(isShelfId("Reading")).toBe(false);
    expect(isShelfId(1)).toBe(false);
  });

  it("has a short and a full label for DNF", () => {
    expect(getShelfInfo("dnf")).toMatchObject({ label: "DNF", fullLabel: "Did not finish" });
  });
});
