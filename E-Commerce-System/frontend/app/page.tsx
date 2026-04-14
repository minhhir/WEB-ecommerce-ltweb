"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import { getRoleHome, useSession } from "@/components/session-provider";

export default function HomePage() {
	const router = useRouter();
	const { currentUser, ready } = useSession();

	useEffect(() => {
		if (!ready) {
			return;
		}

		router.replace(currentUser ? getRoleHome(currentUser.role_id) : "/login");
	}, [currentUser, ready, router]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Spin size="large" />
		</div>
	);
}
