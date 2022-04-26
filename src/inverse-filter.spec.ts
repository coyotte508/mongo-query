import { expect } from "chai";
import { inverseFilter } from "./inverse-filter";

describe("inverseFilter", () => {
  it("should invert {name: 'abc'} by using $ne", () => {
    expect(inverseFilter({ name: "abc" })).to.deep.equal({ name: { $ne: "abc" } });
  });

  it("should invert {name: RegExp} by using $not", () => {
    expect(inverseFilter({ name: /abc/ })!["name"]).to.have.property("$not");
  });

  it("should invert {level: {$gt: 1}} by using $not", () => {
    expect(inverseFilter({ level: { $gt: 1 } })).to.deep.equal({ level: { $not: { $gt: 1 } } });
  });

  it("should invert {name: 'abc', status: 'closed'} by using $or + $ne", () => {
    expect(inverseFilter({ name: "abc", status: "closed" })).to.deep.equal({
      $or: [{ name: { $ne: "abc" } }, { status: { $ne: "closed" } }],
    });
  });

  it("should invert {level: {$gt: 1}, points: {$lt: 0}} by using $or + $not", () => {
    expect(inverseFilter({ level: { $gt: 1 }, points: { $lt: 0 } })).to.deep.equal({
      $or: [{ level: { $not: { $gt: 1 } } }, { points: { $not: { $lt: 0 } } }],
    });
  });

  it("should invert {level: {$gt: 1}, name: 'abc'} by using $or + $ne/$not", () => {
    expect(inverseFilter({ level: { $gt: 1 }, name: "abc" })).to.deep.equal({
      $or: [{ level: { $not: { $gt: 1 } } }, { name: { $ne: "abc" } }],
    });
  });

  it("should invert {level: {$gt: 1, $lt: 3}} by using $not", () => {
    expect(inverseFilter({ level: { $gt: 1, $lt: 3 } })).to.deep.equal({ level: { $not: { $gt: 1, $lt: 3 } } });
  });

  it("should invert {$or: [{name: 'abc'}, {level: 1}]} into {name: {$ne: 'abc'}, level: {$ne: 1}}", () => {
    expect(inverseFilter({ $or: [{ name: "abc" }, { level: 1 }] })).to.deep.equal({
      name: { $ne: "abc" },
      level: { $ne: 1 },
    });
  });

  it("should invert {$and: [{name: 'abc'}, {level: 1}]} into {$or: [{name: {$ne: 'abc'}}, {$level: {$ne: 1}}]}", () => {
    expect(inverseFilter({ $and: [{ name: "abc" }, { level: 1 }] })).to.deep.equal({
      $or: [{ name: { $ne: "abc" } }, { level: { $ne: 1 } }],
    });
  });

  it("should invert {$and: [{name: 'abc'}]} into {name: {$ne: 'abc'}}", () => {
    expect(inverseFilter({ $and: [{ name: "abc" }, { level: 1 }] })).to.deep.equal({
      $or: [{ name: { $ne: "abc" } }, { level: { $ne: 1 } }],
    });
  });

  it("should invert {key: {$in: [0, 1]}} into {key: {$nin: [0, 1]}}", () => {
    expect(inverseFilter({ key: { $in: [0, 1] } })).to.deep.equal({
      key: { $nin: [0, 1] },
    });
  });

  it("should invert {key: {$nin: [0, 1]}} into {key: {$in: [0, 1]}}", () => {
    expect(inverseFilter({ key: { $nin: [0, 1] } })).to.deep.equal({
      key: { $in: [0, 1] },
    });
  });

  it("should invert {key: {$exists: true}} into {key: {$exists: false}}", () => {
    expect(inverseFilter({ key: { $exists: true } })).to.deep.equal({ key: { $exists: false } });
    expect(inverseFilter({ key: { $exists: false } })).to.deep.equal({ key: { $exists: true } });
  });

  // Todo: invert $gt with $lte, $lt with $gte, $ne with equality ...
});
