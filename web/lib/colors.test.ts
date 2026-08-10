import { describe, expect, it } from "vitest";
import { categoryColorClass } from "./colors";
import { UNCATEGORIZED_LABEL } from "./events";

describe("categoryColorClass", () => {
  it("returns the same class for the same keyword every time", () => {
    const first = categoryColorClass("エヴァンゲリオン");
    const second = categoryColorClass("エヴァンゲリオン");

    expect(first).toBe(second);
  });

  it("returns different classes for different keywords (no collision for this pair)", () => {
    expect(categoryColorClass("エヴァンゲリオン")).not.toBe(categoryColorClass("バイオハザード"));
  });

  it("returns a neutral class for the uncategorized bucket", () => {
    const result = categoryColorClass(UNCATEGORIZED_LABEL);

    expect(result).toContain("slate");
  });

  it("returns a non-empty class string for an empty keyword", () => {
    expect(categoryColorClass("")).toBeTruthy();
  });
});
