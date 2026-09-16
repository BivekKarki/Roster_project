"use client";

import { createContext, useContext } from "react";

export type CurrentUser = {
  name: string | null;
  email: string;
  /** Milliseconds timestamp of the last photo upload, or null when there is no photo */
  avatarVersion: number | null;
};

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export const useCurrentUser = () => useContext(UserContext);
