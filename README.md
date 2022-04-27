# mongoquery

Typescript utilities to manipulate the MongoDB query language.

Get it with `npm add @coyotte508/mongo-query`.

## parseFilter

```ts
/**
 * @param filter Human-readable boolean filter, eg !(A&&(!B)&&(C||D))
 * @param replace A map or replacement function to replace keys by mongodb filters
 * @returns A mongodb filter
 */
function parseFilter(filter: string): SearchGroupJson<string>;
function parseFilter<T>(
  filter: string,
  replace: Map<string, Filter<T>> | ((key: string) => Filter<T>)
): Filter<T>;
```

This converts a human-readable boolean filter into a MongoDB filter.

`filter` can make use of the following operators: `!`, `||` and `&&`, and parenthesis. It's not possible to chain an operator directly with `!`, but
there is a shortcut: `A&!B` is equivalent to `A&&(!B)`.

`replace` is a map or function used to replace `A`, `B`, ... by real mongodb expressions.

For example, it can be:

```ts
function replace(expr: `${key}:${val}`) {
  const [key, val] = expr.split(":");

  return {key: {$in: val.split(',')}};
}
```

or:

```ts
replace = new Map([
  ["A", {user: 'somebody'}],
  ["B", {createdAt: {$lt: 'somedate'}}],
  ["C", someOtherCondition],
  ...
])
```

The return value is a mongodb filter, with a combination of `$and`, `$or` and `$nor`.

For example, `parseFilter("!(A&&(!B)&&(C||D))")` will return:

```ts
{"$and":[{"$nor":[{"$and":["A",{"$and":[{"$nor":["B"]}]},{"$or":["C","D"]}]}]}]}
```

The output is verbose, so use it in conjunction with `simplifyFilter`.

## simplifyFilter

```ts
function simplifyFilter<T>(filter: Filter<T>): Filter<T>
```

The result of `parseFilter` can be verbose, with many logical groupings. `simplifyFilter` aims to simplify the filter so it becomes less verbose.

For example, `simplifyFilter(parseFilter("!(A&&(!B)&&(C||D))"), key => ({[key]: 1}))` becomes:

```ts
{"$or":[{"A":{"$ne":1}},{"B":1},{"C":{"$ne":1},"D":{"$ne":1}}]}
```

## inverseFilter

```ts
function inverseFilter<T>(filter: Filter<T>): Filter<T>
```

This inverts a filter. For example, `inverseFilter({a: {$in: [1, 2]}})` will become `{a: {$nin: [1, 2]}}`.

It tries to stay simple but not every inversion is implemented. In which case, `$not` is used.