import { describe, expect, test } from "bun:test";

import {
  extractFindingId,
  extractSeverity,
  parseTimestamp,
} from "../src/query/slots.js";

/** Aligns timestamp examples in docs/reelink-query-algorithm.md §2. */
describe("query slot extraction", () => {
  test.each([
    ["1.5", 1.5],
    ["1.5s", 1.5],
    ["1.5 sec", 1.5],
    ["00:01.5", 1.5],
    ["01:02.25", 62.25],
  ])("parseTimestamp(%s) → %s", (input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });

  test("extractSeverity maps critical and crit to high", () => {
    expect(extractSeverity("critical bugs")).toBe("high");
    expect(extractSeverity("crit issues")).toBe("high");
    expect(extractSeverity("low severity")).toBe("low");
    expect(extractSeverity("no severity here")).toBe(null);
  });

  test("extractFindingId resolves after cue words or bare id", () => {
    expect(extractFindingId("how confident is finding f2")).toBe("f2");
    expect(extractFindingId("work item xyz-01 details")).toBe("xyz-01");
  });
});
