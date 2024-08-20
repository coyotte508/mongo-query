type DifferenceKey<A, B> = Exclude<Extract<keyof A, string>, keyof B>;
type IntersectionKey<A, B> = Exclude<Extract<keyof A, string>, DifferenceKey<A, B>>;

export function pick<T, K extends keyof T>(o: T, props: K[]): Pick<T, K> {
  return Object.fromEntries(
    props.map((prop) => (prop in (o||{}) ? [prop, o[prop]] : null)).filter((x): x is any => x !== null)
  ) as Pick<T, K>;
}

export function intersectionKeys<T1, T2>(o1: T1, o2: T2): IntersectionKey<T1, T2>[] {
  const extraKeys: IntersectionKey<T1, T2>[] = [];

  for (const key in o1) {
    if (key in (o2||{})) {
      extraKeys.push(key as any);
    }
  }

  return extraKeys;
}

export function omit<T, K extends keyof T>(o: T, props: K[]): Pick<T, Exclude<keyof T, K>> {
  const ret = { ...o };

  for (const prop of props) {
    if (prop in (ret||{})) {
      delete ret[prop];
    }
  }

  return ret;
}
