import { expect } from "chai";
import { simplifyFilter } from "./simplify-filter";

describe("SimplifyFilter", () => {
  it("should simplify a $or with only one element", () => {
    expect(simplifyFilter({ $or: [{ a: 1 }] })).to.deep.equal({ a: 1 });
    expect(simplifyFilter({ $or: [{ a: 1 }, { b: 2 }] })).to.deep.equal({ $or: [{ a: 1 }, { b: 2 }] });
    expect(simplifyFilter({ a: 1, $or: [{ a: 2 }] })).to.deep.equal({ a: 1, $and: [{ a: 2 }] });
    expect(simplifyFilter({ a: 1, $or: [{ b: 2 }] })).to.deep.equal({ a: 1, b: 2 });
  });
});
