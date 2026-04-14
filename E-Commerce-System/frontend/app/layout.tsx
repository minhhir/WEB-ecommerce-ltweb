import "@ant-design/v5-patch-for-react-19";
import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntApp, ConfigProvider } from "antd";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
	title: "GreenCart Commerce",
	description: "Frontend ecommerce role-based UI",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body suppressHydrationWarning>
				<AntdRegistry>
					<ConfigProvider
						theme={{
							token: {
								colorPrimary: "#2e7d32",
								borderRadius: 10,
							},
						}}
					>
							<AntApp>
								<SessionProvider>{children}</SessionProvider>
							</AntApp>
					</ConfigProvider>
				</AntdRegistry>
			</body>
		</html>
	);
}
