import { Filter } from "mongodb";
import { intersectionKeys, isOperatorObject, omit, pick } from "./utils";

export function joinAnd<T>(...conds: Filter<T>[]): Filter<T> {
  if (!conds.length) {
    return {};
  }

  const [firstCond, secondCond] = conds;

  if (conds.length === 1) {
    return firstCond;
  }

  const sharedKeys = intersectionKeys(firstCond, secondCond);
  const mergedOperators: Record<string, unknown> = {};
  const conflictingKeys: typeof sharedKeys = [];

  for (const key of sharedKeys) {
    const a = (firstCond as Record<string, unknown>)[key as string];
    const b = (secondCond as Record<string, unknown>)[key as string];

    if (isOperatorObject(a) && isOperatorObject(b) && !Object.keys(a).some((k) => k in b)) {
      mergedOperators[key] = {
        ...a,
        ...b,
      };
      continue;
    }

    conflictingKeys.push(key);
  }

  return joinAnd(
    {
      ...firstCond,
      ...omit(secondCond, sharedKeys),
      ...mergedOperators,
      ...(conflictingKeys.length && {
        $and: [...("$and" in firstCond ? firstCond.$and : []), pick(secondCond, conflictingKeys)],
      }),
    },
    ...conds.slice(2),
  );
}
