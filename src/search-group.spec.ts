import { expect } from "chai";
import { SearchGroup } from "./search-group";
import util from "util";

describe("SearchGroup", () => {
  it("should parse its own `toString()` output", () => {
    const strings = ["(!a)", "(!a&&b)", "(a&&b&&!(c||(d&&e)))", "(foo&&bar&&!((ab||cd)&&(def||ghi)))"];

    for (const string of strings) {
      const group = SearchGroup.fromString(string);
      expect(group.toString()).to.equal(string);
    }
  });

  it("should disambiguate", () => {
    const results = [
      {
        input: "(foo&&(bar||def))",
        output: "(foo&&(bar||def))",
      },
      {
        input: "(foo&&bar&&!((ab||cd)&&(def||ghi)))",
        output: "(foo&&bar&&!((ab||cd)&&(def||ghi)))",
      },
      {
        input: "(foo&&bar&&!ab||cd&&def||ghi)",
        output: "((foo&&bar&&!ab)||(cd&&def)||ghi)",
      },
      {
        input: "(foo&&bar&&!(ab||cd)&&def||ghi)",
        output: "((foo&&bar&&!(ab||cd)&&def)||ghi)",
      },
    ];
    let i = 0;
    for (const { input, output } of results) {
      const group = SearchGroup.fromString(input);
      group.disambiguate();
      expect(group.toString()).to.equal(output, `Test case ${i}`);
      i++;
    }
  });

  it("should produce correct JSON representation", () => {
    const results = [
      {
        input: "(!a)",
        output: {
          $and: [{ $nor: ["a"] }],
        },
      },
      {
        input: "(!a&&b)",
        output: {
          $and: [{ $nor: ["a"] }, "b"],
        },
      },
      {
        input: "(a&&b)",
        output: {
          $and: ["a", "b"],
        },
      },
      {
        input: "!(a&&b)",
        output: {
          $or: [{ $nor: ["a"] }, { $nor: ["b"] }],
        },
      },
      {
        input: "(foo&&bar&&!((ab||cd)&&(def||ghi)))",
        output: {
          $and: ["foo", "bar", { $or: [{ $nor: ["ab", "cd"] }, { $nor: ["def", "ghi"] }] }],
        },
      },
      {
        input: "(foo&&bar&&!ab||cd&&def||ghi)",
        output: {
          $or: [{ $and: ["foo", "bar", { $nor: ["ab"] }] }, { $and: ["cd", "def"] }, "ghi"],
        },
      },
      {
        input: "(foo&&bar&&!(ab||cd)&&def||ghi)",
        output: {
          $or: [{ $and: ["foo", "bar", { $nor: ["ab", "cd"] }, "def"] }, "ghi"],
        },
      },
      {
        input: "(!(bar&&(key1||key2))&&foo)",
        output: {
          $and: [
            {
              $or: [{ $nor: ["bar"] }, { $nor: ["key1", "key2"] }],
            },
            "foo",
          ],
        },
      },
    ];

    let i = 0;
    for (const { input, output } of results) {
      const group = SearchGroup.fromString(input);
      expect(group.toJSON()).to.deep.equal(output, `Test case ${i}`);
      i++;
    }
  });

  it("should product correct string representation", () => {
    const group = SearchGroup.fromString("!(A&&C)");

    expect(group.toString()).to.equal("!(A&&C)");
  });

  it("should list keys", () => {
    const group = SearchGroup.fromString("!(A&&(!B)&&(C||D))");
    expect([...group.keys]).to.deep.equal(["A", "B", "C", "D"]);
  });

  it("should be able to remove keys", () => {
    const group = SearchGroup.fromString("!(A&&(!B)&&(C||D))");
    expect(group.toString()).to.equal("!(A&&(!B)&&(C||D))");
    group.keys = new Set(["A", "C"]);
    expect(group.toString()).to.equal("!(A&&C)");
  });

  // Don't know whether to return !(A&&C&&E) or (!(A&&C)&&E)
  // so not implemented for now
  it.skip("should be able to add keys", () => {
    const group = SearchGroup.fromString("!(A&&C)");
    group.keys = new Set(["A", "C", "E"]);
    expect(group.toString()).to.equal("!(A&&C&&E)");
  });
});
