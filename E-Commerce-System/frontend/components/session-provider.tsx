"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { RoleId, User } from "@/types";
const STORAGE_KEY = "greencart-current-user";
const TOKEN_KEY = "greencart-token";

// Định nghĩa kiểu giá trị của context
interface SessionContextValue {
  currentUser: User | null;
  ready: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

// Tạo context với giá trị mặc định là null
const SessionContext = createContext<SessionContextValue | null>(null);
// Hàm tiện ích để lấy đường dẫn home dựa trên role_id
export function getRoleHome(roleId: RoleId) {
  if (roleId === 1) return "/admin";
  if (roleId === 2) return "/seller";
  return "/marketplace";
}

export function SessionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // Khởi tạo currentUser từ localStorage khi component mount
  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (rawValue && token) {
        setCurrentUser(JSON.parse(rawValue) as User);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    } finally {
      setReady(true);
    }
  }, []);
  // Đồng bộ currentUser với localStorage mỗi khi nó thay đổi
  useEffect(() => {
    if (!ready) return;
    if (currentUser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }, [currentUser, ready]);

  // Đảm bảo giá trị context chỉ thay đổi khi currentUser hoặc ready thay đổi
  const value = useMemo(
    () => ({
      currentUser,
      ready,
      login: (user: User, token: string) => {
        window.localStorage.setItem(TOKEN_KEY, token);
        setCurrentUser(user);
      },
      logout: () => {
        window.localStorage.removeItem(TOKEN_KEY);
        setCurrentUser(null);
      },
    }),
    [currentUser, ready],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Hook để sử dụng context trong các component con
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
