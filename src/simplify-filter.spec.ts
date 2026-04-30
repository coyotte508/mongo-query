import { expect } from "chai";
import { simplifyFilter } from "./simplify-filter";

describe("SimplifyFilter", () => {
  it("should simplify a $or with only one element", () => {
    expect(simplifyFilter({ $or: [{ a: 1 }] })).to.deep.equal({ a: 1 });
    expect(simplifyFilter({ $or: [{ a: 1 }, { b: 2 }] })).to.deep.equal({ $or: [{ a: 1 }, { b: 2 }] });
    expect(simplifyFilter({ a: 1, $or: [{ a: 2 }] })).to.deep.equal({ a: 1, $and: [{ a: 2 }] });
    expect(simplifyFilter({ a: 1, $or: [{ b: 2 }] })).to.deep.equal({ a: 1, b: 2 });
  });

  it("should simplify a $and with multiple operators on same key", () => {
    expect(simplifyFilter({ $and: [{ x: { $gte: 1 } }, { x: { $lte: 2 } }] })).to.deep.equal({
      x: { $gte: 1, $lte: 2 },
    });

    expect(simplifyFilter({ $and: [{ x: { $gte: 1 } }, { x: { $lte: 5 } }, { x: { $ne: 3 } }] })).to.deep.equal({
      x: { $gte: 1, $lte: 5, $ne: 3 },
    });

    expect(simplifyFilter({ x: { $gte: 1 }, $and: [{ x: { $lte: 5 } }] })).to.deep.equal({
      x: { $gte: 1, $lte: 5 },
    });
  });

  it("should not merge operator objects when they share an operator", () => {
    expect(simplifyFilter({ $and: [{ x: { $gte: 1 } }, { x: { $gte: 2 } }] })).to.deep.equal({
      x: { $gte: 1 },
      $and: [{ x: { $gte: 2 } }],
    });
  });

  it("should not merge equality conditions on the same key", () => {
    expect(simplifyFilter({ $and: [{ x: 1 }, { x: 2 }] })).to.deep.equal({
      x: 1,
      $and: [{ x: 2 }],
    });

    expect(simplifyFilter({ $and: [{ x: { $gte: 1 } }, { x: 5 }] })).to.deep.equal({
      x: { $gte: 1 },
      $and: [{ x: 5 }],
    });
  });

  it("should not treat RegExp values as operator objects", () => {
    const re = /abc/;
    expect(simplifyFilter({ $and: [{ x: re }, { x: { $exists: true } }] })).to.deep.equal({
      x: re,
      $and: [{ x: { $exists: true } }],
    });
  });

  it("should remove empty $and / $or branches", () => {
    expect(simplifyFilter({ $and: [] })).to.deep.equal({});
    expect(simplifyFilter({ $or: [] })).to.deep.equal({});
    expect(simplifyFilter({ a: 1, $and: [] })).to.deep.equal({ a: 1 });
    expect(simplifyFilter({ a: 1, $or: [] })).to.deep.equal({ a: 1 });
  });

  it("should drop empty objects from $and", () => {
    expect(simplifyFilter({ $and: [{}, { a: 1 }, {}] })).to.deep.equal({ a: 1 });
  });

  it("should not drop empty objects from $or", () => {
    expect(simplifyFilter({ $or: [{}, { a: 1 }, {}] })).to.deep.equal({ $or: [{}, { a: 1 }, {}] });
  });

  it("should recursively simplify $or branches", () => {
    expect(simplifyFilter({ $or: [{ $and: [{ a: 1 }] }, { $or: [{ b: 2 }] }] })).to.deep.equal({
      $or: [{ a: 1 }, { b: 2 }],
    });
  });

  it("should keep a $or with multiple distinct branches untouched", () => {
    expect(simplifyFilter({ $or: [{ a: 1 }, { b: 2 }, { c: 3 }] })).to.deep.equal({
      $or: [{ a: 1 }, { b: 2 }, { c: 3 }],
    });
  });

  it("should leave a simple filter untouched", () => {
    expect(simplifyFilter({ a: 1, b: 2 })).to.deep.equal({ a: 1, b: 2 });
    expect(simplifyFilter({})).to.deep.equal({});
    expect(simplifyFilter({ x: { $gte: 1, $lte: 2 } })).to.deep.equal({ x: { $gte: 1, $lte: 2 } });
  });

  it("should convert $nor into the inverted equivalent", () => {
    expect(simplifyFilter({ $nor: [{ a: 1 }] })).to.deep.equal({ a: { $ne: 1 } });
    expect(simplifyFilter({ $nor: [{ a: 1 }, { b: 2 }] })).to.deep.equal({
      a: { $ne: 1 },
      b: { $ne: 2 },
    });
  });
});
