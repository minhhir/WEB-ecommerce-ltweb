"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { RoleId, User } from "@/types";

const STORAGE_KEY = "greencart-current-user";

interface SessionContextValue {
  currentUser: User | null;
  ready: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function getRoleHome(roleId: RoleId) {
  if (roleId === 1) {
    return "/admin";
  }

  if (roleId === 2) {
    return "/seller";
  }

  return "/marketplace";
}

export function SessionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      if (rawValue) {
        setCurrentUser(JSON.parse(rawValue) as User);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (currentUser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [currentUser, ready]);

  const value = useMemo(
    () => ({
      currentUser,
      ready,
      login: setCurrentUser,
      logout: () => setCurrentUser(null),
    }),
    [currentUser, ready],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
