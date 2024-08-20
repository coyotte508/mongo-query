import { expect } from "chai";
import { SearchGroup } from "./search-group";

describe("SearchGroup", () => {
  it("should parse its own `toString()` output", () => {
    const strings = ["(foo&&bar&!((ab||cd)&&(def||ghi)))", "(a&&b&!(c||(d&&e)))", "(!a)", "(!a&&b)"];

    for (const string of strings) {
      expect(SearchGroup.fromString(string).toString()).to.equal(string);
    }
  });

  it("should disambiguate", () => {
    const string = "(foo&&bar&!((ab||cd)&&(def||ghi)))";
    expect(SearchGroup.fromString(string).disambiguate().toString()).to.equal(string);

    expect(SearchGroup.fromString("(foo&&bar&!ab||cd&&def||ghi)").disambiguate().toString()).to.equal(
      "((foo&&bar&!ab)||(cd&&def)||ghi)",
    );

    expect(SearchGroup.fromString("(foo&&bar&!(ab||cd)&&def||ghi)").disambiguate().toString()).to.equal(
      "((foo&&bar&!(ab||cd)&&def)||ghi)",
    );
  });

  it("should produce correct JSON representation", () => {
    expect(SearchGroup.fromString("(foo&&bar&!((ab||cd)&&(def||ghi)))").toJSON()).to.deep.equal(
      {
        $and: ["foo", "bar", { $nor: [{ $and: [{ $or: ["ab", "cd"] }, { $or: ["def", "ghi"] }] }] }],
      },
      "(foo&&bar&!((ab||cd)&&(def||ghi)))",
    );

    expect(SearchGroup.fromString("(foo&&bar&!ab||cd&&def||ghi)").toJSON()).to.deep.equal(
      {
        $or: [{ $and: ["foo", "bar", { $nor: ["ab"] }] }, { $and: ["cd", "def"] }, "ghi"],
      },
      "(foo&&bar&!ab||cd&&def||ghi)",
    );

    expect(SearchGroup.fromString("(foo&&bar&!(ab||cd)&&def||ghi)").toJSON()).to.deep.equal(
      {
        $or: [{ $and: ["foo", "bar", { $nor: [{ $or: ["ab", "cd"] }] }, "def"] }, "ghi"],
      },
      "(foo&&bar&!(ab||cd)&&def||ghi)",
    );

    expect(SearchGroup.fromString("(!a)").toJSON()).to.deep.equal(
      {
        $and: [{ $nor: ["a"] }],
      },
      "(!a)",
    );

    expect(SearchGroup.fromString("(!(bar&&(key1||key2))&&foo)").toJSON()).to.deep.equal(
      {
        $and: [
          {
            $nor: [
              {
                $and: [
                  "bar",
                  {
                    $or: ["key1", "key2"],
                  },
                ],
              },
            ],
          },
          "foo",
        ],
      },
      "(!(bar&&(key1||key2))&&foo)",
    );
  });

  it("should list keys", () => {
    const group = SearchGroup.fromString("!(A&&(!B)&&(C||D))");
    expect([...group.keys()]).to.deep.equal(["A", "B", "C", "D"]);
  });
});
