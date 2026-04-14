"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Result, Spin } from "antd";
import { getRoleHome, useSession } from "@/components/session-provider";
import { RoleId } from "@/types";

export function RoleGate({ allowedRoles, children }: Readonly<{ allowedRoles: RoleId[]; children: React.ReactNode }>) {
  const router = useRouter();
  const { currentUser, ready } = useSession();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!currentUser) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(currentUser.role_id)) {
      router.replace(getRoleHome(currentUser.role_id));
    }
  }, [allowedRoles, currentUser, ready, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!currentUser || !allowedRoles.includes(currentUser.role_id)) {
    return <Result status="403" title="Dang chuyen huong" />;
  }

  return <>{children}</>;
}