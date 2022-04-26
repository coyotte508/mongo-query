import { Filter } from "mongodb";
import type { RequireExactlyOne } from "type-fest";

type SearchItemJson<ValueType = string> = ValueType;

export type SearchValueJson<ValueType = string> =
  | SearchItemJson<ValueType>
  | SearchGroupJson<ValueType>
  | { $nor: SearchValueJson<ValueType> };

interface _SearchGroupJson<ValueType = string> {
  $or: SearchValueJson<ValueType>[];
  $and: SearchValueJson<ValueType>[];
}

export type SearchGroupJson<ValueType = string> = RequireExactlyOne<_SearchGroupJson<ValueType>, "$and" | "$or">;

type SearchValue = SearchGroup | SearchItem;

export enum SearchOperator {
  And = "&&",
  Or = "||",
  AndNot = "&!",
}

export enum UnarySearchOperator {
  Yes = "",
  Not = "!",
}

function priority(operator: SearchOperator) {
  switch (operator) {
    case SearchOperator.And:
    case SearchOperator.AndNot:
      return 10;
    case SearchOperator.Or:
    default:
      return 0;
  }
}

export class SearchItem {
  constructor(public key: string) {}

  next: {
    operator: SearchOperator;
    item: SearchValue;
  } | null = null;

  toString(): string {
    if (!this.next) {
      return this.key;
    }

    return `${this.key}${this.next.operator}${this.next.item.toString()}`;
  }

  clone(): SearchItem {
    const item = new SearchItem(this.key);

    if (this.next) {
      item.next = {
        operator: this.next.operator,
        item: this.next.item.clone(),
      };
    }

    return item;
  }
}

export class SearchGroup {
  first: SearchValue | null = null;
  firstOperator: UnarySearchOperator = UnarySearchOperator.Yes;

  next: {
    operator: SearchOperator;
    item: SearchValue;
  } | null = null;

  [Symbol.iterator](): IterableIterator<SearchValue> {
    let current = this.first;

    const it = {
      [Symbol.iterator]: () => it,
      next() {
        if (!current) {
          return {
            done: true,
            value: null,
          } as const;
        }

        try {
          return {
            done: false,
            value: current,
          } as const;
        } finally {
          current = current.next?.item ?? null;
        }
      },
    };

    return it;
  }

  get isEmpty() {
    return !this.first;
  }

  toString(): string {
    if (!this.first) {
      return "";
    }

    if (!this.next) {
      return `(${this.firstOperator}${this.first.toString()})`;
    }

    return `(${this.firstOperator}${this.first.toString()})${this.next.operator}${this.next.item.toString()}`;
  }

  static fromString(str: string, map = new Map<number, SearchGroup>()): SearchGroup {
    if (!str) {
      return new SearchGroup();
    }

    if (!/^\(.*\)$/.test(str)) {
      str = `(${str})`;
    }

    // First pass sub-groups and add their references to the map
    while (1) {
      const match = /^\(.*(\([^)]+\)).*\)$/.exec(str);

      if (match) {
        const found = match[1];
        const group = SearchGroup.fromString(found, map);

        const key = map.size;
        map.set(key, group);
        str = str.replace(found, `$${key}`);
      } else {
        break;
      }
    }

    // Then parse the flat string which should not contain anymore parenthesis
    const ret = new SearchGroup();
    if (str[1] === "!") {
      str = "(" + str.slice(2);
      ret.firstOperator = UnarySearchOperator.Not;
    }
    const arr = str.slice(1, -1).split(/(&&|&!|\|\|)/);

    const parseItem = (itemStr: string) =>
      itemStr.startsWith("$") ? map.get(+itemStr.slice(1))! : new SearchItem(itemStr);
    ret.first = parseItem(arr[0]);

    let index = 1;
    let current = ret.first;

    while (index + 1 < arr.length) {
      const operator = arr[index] as SearchOperator;
      const nextItem = parseItem(arr[index + 1]);

      current.next = { item: nextItem, operator };
      current = nextItem;

      index += 2;
    }

    return ret;
  }

  clone(): SearchGroup {
    const group = new SearchGroup();

    if (this.first) {
      group.first = this.first.clone();
      group.firstOperator = this.firstOperator;
    }

    if (this.next) {
      group.next = { operator: this.next.operator, item: this.next.item.clone() };
    }

    return group;
  }

  /* Create groups based on operator priorities */
  disambiguate(): this {
    for (let member of this) {
      if (member instanceof SearchGroup) {
        member.disambiguate();
      }
    }

    let previous: SearchValue | undefined;
    let start = this.first;
    let current = start;
    let beforeCurrent: SearchValue | undefined;
    let operator: SearchOperator | undefined;

    while (current) {
      const nextOperator = current?.next?.operator;

      if (!nextOperator) {
        return this;
      }

      // Only support two priorities. Otherwise would have to maintain stacks
      if (operator && priority(operator) !== priority(nextOperator)) {
        if (priority(nextOperator) > priority(operator)) {
          previous = beforeCurrent;
          start = current;
        } else {
          // Close the group
          const group = new SearchGroup();

          group.first = start;
          group.next = current.next;
          current.next = null;

          if (previous) {
            previous.next!.item = group;
          } else {
            this.first = group;
          }

          current = group;
          start = current;
        }
      }

      operator = nextOperator;
      beforeCurrent = current;
      current = current!.next?.item ?? null;
    }
    return this;
  }

  toJSON<T = string>(replace?: Map<string, T> | ((key: string) => T)): SearchGroupJson<T> {
    const clone = this.clone();

    clone.disambiguate();

    const jsonify: (value: SearchValue) => SearchValueJson<T> = (value: SearchValue) => {
      if (value instanceof SearchGroup) {
        const items: SearchValueJson<T>[] = [];
        const base: SearchGroupJson<T> =
          value.first?.next?.operator === SearchOperator.Or ? { $or: items } : { $and: items };

        let neg = value.firstOperator === UnarySearchOperator.Not;
        for (const member of value) {
          items.push(neg ? { $nor: jsonify(member) } : jsonify(member));

          neg = member.next?.operator === SearchOperator.AndNot;
        }

        return base;
      }

      if (replace instanceof Map) {
        if (!replace.has(value.key)) {
          throw new Error("No replacement for " + value.key);
        }
        return replace.get(value.key)!;
      } else if (typeof replace === "function") {
        return replace(value.key);
      }

      // group instanceof SearchItem
      return value.key as any as T;
    };

    return jsonify(clone) as SearchGroupJson<T>;
  }
}

/**
 * @param combination Human-readable boolean combination, eg !(A&&(!B)&&(C||D))
 * @param replace A map or replacement function to replace keys by mongodb filters
 * @returns A mongodb filter
 */
export function parseFilter(combination: string, replace?: Map<string, any> | ((key: string) => any)): Filter<any> {
  return SearchGroup.fromString(combination).toJSON(replace);
}
