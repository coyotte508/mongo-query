import { joinAnd } from "./join-and";
import type { Filter } from "mongodb";

export function inverseFilter<T>(filter: Filter<T>): Filter<T> {
  const keys = Object.keys(filter) as Array<keyof Filter<T>>;

  if (typeof filter === "string") {
    // Should never happen
    return { $nor: filter };
  }

  if (!keys.length) {
    return {};
  }

  if (keys.length > 1) {
    return {
      $or: keys.map((key) => inverseFilter({ [key]: filter[key] } as any)),
    } as any;
  }

  // keys.length === 1

  // !(A && B) => !A || !B
  if ("$and" in filter) {
    if (filter.$and.length === 1) {
      return inverseFilter(filter.$and[0]) as any;
    }
    return {
      $or: filter.$and.map((subCond) => inverseFilter(subCond)),
    };
  }

  if ("$nor" in filter) {
    if (filter.$nor.length === 1) {
      return filter.$nor[0] as any;
    }
    return {
      $or: filter.$nor,
    };
  }

  // !(A || B) => !A && !B
  if ("$or" in filter) {
    // Could also use $nor
    return joinAnd(...filter.$or.map((subCond) => inverseFilter(subCond))) as any;
  }

  const [key] = keys;
  const val = filter[key] as any;
  if (typeof val === "object" && !Array.isArray(val) && Object.keys(val)[0]?.startsWith("$")) {
    if (Object.keys(val).length === 1) {
      if ("$in" in val) {
        return { [key]: { $nin: val.$in } } as any;
      }
      if ("$nin" in val) {
        return { [key]: { $in: val.$nin } } as any;
      }
      if ("$exists" in val) {
        return { [key]: { $exists: !val.$exists } } as any;
      }
    }
    return { [key]: { $not: val } } as any;
  }

  if (val && typeof val === "object" && val instanceof RegExp) {
    return { [key]: { $not: val } } as any;
  }

  return { [key]: { $ne: val } } as any;
}
