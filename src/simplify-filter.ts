import { Filter } from "mongodb";
import { inverseFilter } from "./inverse-filter";
import { joinAnd } from "./join-and";
import { omit } from "./utils";

export function simplifyFilter<T>(filter: Filter<T>): Filter<T> {
  if ("$nor" in filter) {
    filter = joinAnd(omit(filter, ["$nor"]) as Filter<T>, ...(filter.$nor.map(inverseFilter) as Filter<T>[]));
  }
  if ("$and" in filter) {
    if (filter.$and.length === 0) {
      delete filter.$and;
    } else {
      filter = joinAnd(omit(filter, ["$and"]) as Filter<T>, ...(filter.$and.map(simplifyFilter) as Filter<T>[]));
    }
  }
  if ("$or" in filter) {
    if (filter.$or.length === 0) {
      delete filter.$or;
    } else {
      filter = { ...filter, $or: filter.$or.map(simplifyFilter) };
    }
  }

  return filter;
}
