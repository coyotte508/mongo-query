import type { RequireExactlyOne } from "type-fest";

type SearchItemJson<ValueType = string> = ValueType | { $nor: ValueType[] };

export type SearchValueJson<ValueType = string> = SearchItemJson<ValueType> | SearchGroupJson<ValueType>;

interface _SearchGroupJson<ValueType = string> {
  $or: SearchValueJson<ValueType>[];
  $and: SearchValueJson<ValueType>[];
  $nor: SearchValueJson<ValueType>[];
}

function invertUnaryOperator(operator: UnarySearchOperator): UnarySearchOperator {
  return operator === UnarySearchOperator.Not ? UnarySearchOperator.Yes : UnarySearchOperator.Not;
}

function combineUnaryOperators(operator1: UnarySearchOperator, operator2: UnarySearchOperator): UnarySearchOperator {
  return operator1 === operator2 ? UnarySearchOperator.Yes : UnarySearchOperator.Not;
}

export type SearchGroupJson<ValueType = string> = RequireExactlyOne<
  _SearchGroupJson<ValueType>,
  "$and" | "$or" | "$nor"
>;

type SearchValue = SearchGroup | SearchItem;

export enum SearchOperator {
  And = "&&",
  Or = "||",
}

export enum UnarySearchOperator {
  Yes = "",
  Not = "!",
}

function priority(operator: SearchOperator) {
  switch (operator) {
    case SearchOperator.And:
      return 10;
    case SearchOperator.Or:
    default:
      return 0;
  }
}

export class SearchItem {
  key: string;
  operator: UnarySearchOperator;

  constructor(k: string) {
    if (k.startsWith("!")) {
      this.key = k.slice(1);
      this.operator = UnarySearchOperator.Not;
    } else {
      this.key = k;
      this.operator = UnarySearchOperator.Yes;
    }
  }

  next: {
    operator: SearchOperator;
    item: SearchValue;
  } | null = null;

  toString(): string {
    if (!this.next) {
      return `${this.operator}${this.key}`;
    }

    return `${this.operator}${this.key}${this.next.operator}${this.next.item.toString()}`;
  }

  clone(): SearchItem {
    const item = new SearchItem(this.key);
    item.operator = this.operator;

    if (this.next) {
      item.next = {
        operator: this.next.operator,
        item: this.next.item.clone(),
      };
    }

    return item;
  }
}

function invertJSON<T>(json: SearchGroupJson<T> | SearchValueJson<T>): SearchValueJson<T> {
  if (typeof json === "object" && json && "$and" in json && json.$and) {
    if (json.$and.length === 1) {
      return invertJSON(json.$and[0]);
    }
    return {
      $or: json.$and.map(invertJSON),
    };
  }
  if (typeof json === "object" && json && "$or" in json && json.$or) {
    if (json.$or.length === 1) {
      return invertJSON(json.$or[0]);
    }
    return {
      // $and: json.$or.map(invertJSON),
      $nor: json.$or,
    };
  }
  if (typeof json === "object" && json && "$nor" in json && json.$nor) {
    if (json.$nor.length === 1) {
      return json.$nor[0];
    }
    return {
      $or: json.$nor,
    };
  }
  return {
    $nor: [json],
  };
}

export class SearchGroup {
  first: SearchValue | null = null;
  operator: UnarySearchOperator = UnarySearchOperator.Yes;

  next: {
    operator: SearchOperator;
    item: SearchValue;
  } | null = null;

  *[Symbol.iterator](): IterableIterator<SearchValue> {
    let item = this.first;

    while (item) {
      yield item;
      item = item.next?.item ?? null;
    }
  }

  get keys(): Iterable<string> {
    const traverse: (group: SearchGroup) => Generator<string> = function* (group: SearchGroup) {
      for (let member of group) {
        if (member instanceof SearchItem) {
          yield member.key;
        } else {
          yield* traverse(member);
        }
      }
    };

    return traverse(this);
  }

  swap(key1: string, key2: string) {
    const [item1, item2] = [this.item(key1), this.item(key2)];

    if (item1 && item2) {
      [item1.key, item2.key] = [key2, key1];
    }
  }

  item(key: string): SearchItem | undefined {
    for (let item of this) {
      if (item instanceof SearchItem) {
        if (item.key === key) {
          return item;
        }
      } else {
        const result = item.item(key);
        if (result) {
          return result;
        }
      }
    }
  }

  group(keys: Set<string>) {
    const smallest = this.smallestGroupWithKeys(keys)!.group;

    let beginning: SearchValue | undefined;
    let last: SearchValue | undefined;

    for (const member of smallest) {
      if (!beginning) {
        if (member instanceof SearchGroup && [...keys].some((key) => [...member.keys].includes(key))) {
          last = beginning = member;
        } else if (member instanceof SearchItem && keys.has(member.key)) {
          last = beginning = member;
        }
      } else {
        if (member instanceof SearchGroup && [...keys].some((key) => [...member.keys].includes(key))) {
          last = member;
        } else if (member instanceof SearchItem && keys.has(member.key)) {
          last = member;
        }
      }
    }

    const group = new SearchGroup();

    group.first = beginning!;
    group.next = last!.next;
    last!.next = null;

    if (beginning === smallest.first) {
      smallest.first = group;

      return;
    }

    for (const member of smallest) {
      if (member.next?.item === beginning) {
        member.next!.item = group;
        return;
      }
    }
  }

  breakGroup(keys: Set<string>) {
    const { group: smallest, parent } = this.smallestGroupWithKeys(keys)!;

    if (!parent) {
      console.log(smallest);
      throw new Error("Ces critères ne sont pas groupés");
    }

    if (smallest === parent.first) {
      smallest.last!.next = smallest.next;
      parent.first = smallest.first;
      return;
    }

    for (const member of parent) {
      if (member.next?.item === smallest) {
        smallest.last!.next = smallest.next;
        member.next.item = smallest.first!;
        return;
      }
    }
  }

  private smallestGroupWithKeys(
    keys: Set<string>,
    parent?: SearchGroup,
  ): { group: SearchGroup; parent: SearchGroup | null } | null {
    const ownKeys = new Set([...this.keys]);
    for (const key of keys) {
      if (!ownKeys.has(key)) {
        return null;
      }
    }

    for (const item of this) {
      if (item instanceof SearchGroup) {
        const group = item.smallestGroupWithKeys(keys, this);

        if (group) {
          return group;
        }
      }
    }

    return { group: this, parent: parent ?? null };
  }

  get last() {
    let last: SearchValue | null = null;

    for (last of this) {
    }

    return last;
  }

  /**
   * Remove all keys not in the set
   */
  set keys(keys: Set<string>) {
    const currentKeys = new Set([...this.keys]);

    const toRemove = new Set<string>();
    const toAdd: string[] = [];

    for (const key of currentKeys) {
      if (!keys.has(key)) {
        toRemove.add(key);
      }
    }

    for (const key of keys) {
      if (!currentKeys.has(key)) {
        toAdd.push(key);
      }
    }

    this.remove(toRemove);
    this.add(...toAdd);
  }

  add(...keys: string[]) {
    if (keys.length === 0) {
      return;
    }
    if (!this.first) {
      this.first = new SearchItem(keys[0]);
      this.add(...keys.slice(1));
      return;
    }

    let last = this.last!;

    for (const key of keys) {
      last.next = {
        item: new SearchItem(key),
        operator: SearchOperator.And,
      };

      last = last.next.item;
    }
  }

  remove(keys: Set<string>) {
    if (keys.size === 0) {
      return;
    }

    const transform = (item: SearchValue | null): SearchValue | null => {
      if (!item) {
        return null;
      }

      if (item instanceof SearchItem && keys.has(item.key)) {
        return transform(item.next?.item ?? null);
      }

      if (item instanceof SearchGroup) {
        item.remove(keys);

        if (item.isEmpty) {
          return transform(item.next?.item ?? null);
        }

        // Transform single item groups to the item itself
        if (!item.first!.next) {
          item.first!.next = item.next;
          item.first!.operator = combineUnaryOperators(item.operator, item.first!.operator);
          return item.first;
        }
      }

      if (item.next) {
        const nextItem = transform(item.next.item);

        if (nextItem) {
          item.next.item = nextItem;
        } else {
          item.next = null;
        }
      }

      return item;
    };

    this.first = transform(this.first);

    // This is not handled in `transform` when `this` is the root group
    if (!this.first?.next && this.first instanceof SearchGroup) {
      this.first = this.first.first;
    }
  }

  get isEmpty() {
    return !this.first;
  }

  toString(): string {
    if (!this.first) {
      return "";
    }

    if (!this.next) {
      return `${this.operator}(${this.first.toString()})`;
    }

    return `${this.operator}(${this.first.toString()})${this.next.operator}${this.next.item.toString()}`;
  }

  static fromString(str: string, map = new Map<number, SearchGroup>()): SearchGroup {
    if (!str) {
      return new SearchGroup();
    }

    const ret = new SearchGroup();

    if (str[0] === "!") {
      ret.operator = UnarySearchOperator.Not;
      str = str.slice(1);
    }

    if (str.startsWith("(") && str.endsWith(")")) {
      str = str.slice(1, -1);
    }

    // First pass sub-groups and add their references to the map
    while (1) {
      const match = /!?\([^(]*?\)/.exec(str);

      if (match) {
        const found = match[0];
        const group = SearchGroup.fromString(found, map);

        const key = map.size;
        map.set(key, group);
        str = str.replace(found, `$${key}`);
      } else {
        break;
      }
    }

    // Then parse the flat string which should not contain anymore parenthesis
    const arr = str.split(/(&&|\|\|)/);

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
      group.operator = this.operator;
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
      const transform = value.operator === UnarySearchOperator.Not ? invertJSON : (x: any) => x;

      if (value instanceof SearchGroup) {
        const items: SearchValueJson<T>[] = [];

        const base: SearchGroupJson<T> =
          value.first?.next?.operator === SearchOperator.Or ? { $or: items } : { $and: items };

        for (const member of value) {
          items.push(jsonify(member));
        }

        return transform(base);
      }

      if (replace instanceof Map) {
        if (!replace.has(value.key)) {
          throw new Error("No replacement for " + value.key);
        }
        return transform(replace.get(value.key)!);
      } else if (typeof replace === "function") {
        return transform(replace(value.key));
      }

      // group instanceof SearchItem
      return transform(value.key as any as T);
    };

    return jsonify(clone) as SearchGroupJson<T>;
  }
}
