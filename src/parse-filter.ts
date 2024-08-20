import { Filter } from "mongodb";
import { SearchGroup } from "./search-group";

/**
 * @param filter Human-readable boolean filter, eg !(A&&(!B)&&(C||D))
 * @param replace A map or replacement function to replace keys by mongodb filters
 * @returns A mongodb filter
 */
export function parseFilter(filter: string): Filter<any>;
export function parseFilter<T>(
  filter: string,
  replace: Map<string, Filter<T>> | ((key: string) => Filter<T>),
): Filter<T>;
export function parseFilter<T>(
  filter: string,
  replace?: Map<string, Filter<T>> | ((key: string) => Filter<T>),
): Filter<T> {
  return SearchGroup.fromString(filter).toJSON(replace) as unknown as Filter<T>;
}
