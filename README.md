# mongoquery

Typescript utilities to manipulate the MongoDB query language

## parseFilter

```ts
/**
 * @param combination Human-readable boolean combination, eg !(A&&(!B)&&(C||D))
 * @param replace A map or replacement function to replace keys by mongodb filters
 * @returns A mongodb filter
 */
export function parseFilter(combination: string, replace?: Map<string, any> | ((key: string) => any)): Filter<any>
```

This converts a human-readable boolean combination into a MongoDB filter.

`combination` can make use of the following operators: `!`, `||` and `&&`, and parenthesis. It's not possible to chain an operator directly with `!`, but
there is a shortcut: `A&!B` is equivalent to `A&&(!B)`.

`replace` is a map or function used to replace `A`, `B`, ... by real mongodb expression.

For example, it can be:

```ts
function replace(expr: `${key}:${val}`) {
  const [key, val] = expr.split(":");

  return {key: {$in: val.split(',')}};
}
```

or:

```
replace = new Map([
  ["A", {user: 'somebody'}],
  ["B", {createdAt: {$lt: 'somedate'}}],
  ["C", someOtherCondition],
  ...
])
```

The return value is a mongodb filter, with a combination of `$and`, `$or` and `$nor`.

## simplifyFilter

```ts
function simplifyFilter<T>(filter: Filter<T>): Filter<T>
```

The result of `parseFilter` can be verbose, with many logical groupings. `simplifyFilter` aims to simplify the filter so it becomes less verbose.

For example, `{$and: [{$and: [A, B]}, C]}` will become `{$and: [A, B, C]}`.

## inverseFilter

```ts
function inverseFilter<T>(filter: Filter<T>): Filter<T>
```

This inverts a filter. For example, `inverseFilter({a: {$in: [1, 2]}})` will become `{a: {$nin: [1, 2]}}`.

It tries to stay simple but not every inversion is implemented. In which case, `$not` is used.