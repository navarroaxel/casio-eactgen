import { describe, expect, it } from "vitest";
import { applySnippet } from "./insertAtCaret";

describe("applySnippet", () => {
  it("wraps a selection between pre and post", () => {
    const { value, caret } = applySnippet("f(x)", 2, 3, {
      pre: "√{",
      post: "}",
    });
    expect(value).toBe("f(√{x})");
    expect(caret).toBe(5); // right after the selection, before post
  });

  it("inserts at the caret when nothing is selected", () => {
    const { value, caret } = applySnippet("ab", 1, 1, { pre: "^{", post: "}" });
    expect(value).toBe("a^{}b");
    expect(caret).toBe(3);
  });

  it("defaults post to an empty string", () => {
    const { value, caret } = applySnippet("hello", 5, 5, { pre: "!" });
    expect(value).toBe("hello!");
    expect(caret).toBe(6);
  });
});
