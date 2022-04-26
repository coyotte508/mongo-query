import { expect } from "chai";
import { omit } from "./utils";

describe("Utils", () => {
  it("omit", () => {
    expect(omit({ a: 1, b: 2 }, ["a"])).to.deep.equal({ b: 2 });
  });
});
