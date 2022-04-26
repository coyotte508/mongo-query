import { Filter } from "mongodb";
import { intersectionKeys, omit, pick } from "./utils";

export function joinAnd<T>(...conds: Filter<T>[]): Filter<T> {
  if (!conds.length) {
    return {};
  }

  const [firstCond, secondCond] = conds;

  if (conds.length === 1) {
    return firstCond;
  }

  const extraKeys = intersectionKeys(firstCond, secondCond);

  return joinAnd(
    {
      ...firstCond,
      ...omit(secondCond, extraKeys),
      ...(extraKeys.length && {
        $and: [...("$and" in firstCond ? firstCond.$and : []), pick(secondCond, extraKeys)],
      }),
    },
    ...conds.slice(2)
  );
}
