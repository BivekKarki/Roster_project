import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";

/**
 * Cross-request caching, scoped to one user.
 *
 * Pages are user-specific, so they can't be statically cached, but the data behind them only
 * changes when that user writes something. Each cached loader is tagged with the user, and every
 * write calls `bumpUser`, which throws the whole user's cache away. A refresh therefore usually
 * needs no database queries at all, while still showing changes the moment they're made.
 * `revalidate` is a safety net for things that change with the clock (a new day, a payment
 * becoming overdue) rather than with a write.
 */
export const userTag = (userId: string) => `user:${userId}`;

export function bumpUser(userId: string) {
  revalidateTag(userTag(userId));
}

export function cachedForUser<A extends (string | number)[], R>(
  name: string,
  loader: (userId: string, ...args: A) => Promise<R>,
  revalidateSeconds = 300,
) {
  return (userId: string, ...args: A): Promise<R> =>
    unstable_cache(
      () => loader(userId, ...args),
      [name, userId, ...args.map(String)],
      { tags: [userTag(userId)], revalidate: revalidateSeconds },
    )();
}
