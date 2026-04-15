"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Layout, Space, Tag, Typography } from "antd";
import { DownOutlined, LogoutOutlined, ShopOutlined, UserOutlined } from "@ant-design/icons";
import { getRoleHome, useSession } from "@/components/session-provider";

const { Header, Content } = Layout;
const { Text } = Typography;

function getRoleLabel(roleId: number) {
  if (roleId === 1) {
    return "Admin";
  }

  if (roleId === 2) {
    return "Nguoi ban";
  }

  return "Nguoi mua";
}

export function EcommerceShell({
  children,
  title,
  description,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  description?: string;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useSession();

  if (!currentUser) {
    return null;
  }

  const roleHome = getRoleHome(currentUser.role_id);
  const showSellerPage = currentUser.role_id === 2;
  const showAdminPage = currentUser.role_id === 1;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header className="sticky top-0 z-10 flex items-center justify-between border-b border-green-200 bg-white/95 backdrop-blur">
        <Space size={14} wrap>
          <Space size={8}>
            <ShopOutlined className="text-green-700" />
            <Text strong>GreenCart Commerce</Text>
          </Space>
          <Tag color="green">{getRoleLabel(currentUser.role_id)}</Tag>
        </Space>

        <Space wrap>
          <Button type={pathname === "/marketplace" ? "primary" : "default"} onClick={() => router.push("/marketplace")}>
            Trang mua sam
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: "my-orders",
                  label: "Xem danh sach don hang",
                  onClick: () => router.push("/my-orders"),
                },
              ],
            }}
            trigger={["hover"]}
          >
            <Button type={pathname === "/my-orders" ? "primary" : "default"}>
              Don hang <DownOutlined />
            </Button>
          </Dropdown>
          {showSellerPage && (
            <Button type={pathname === "/seller" ? "primary" : "default"} onClick={() => router.push("/seller")}>
              Kho nguoi ban
            </Button>
          )}
          {showAdminPage && (
            <Button type={pathname === "/admin" ? "primary" : "default"} onClick={() => router.push("/admin")}>
              Quan tri
            </Button>
          )}
          <Button icon={<UserOutlined />} onClick={() => router.push(roleHome)}>
            Trang chu
          </Button>
          <Button icon={<LogoutOutlined />} onClick={() => logout()}>
            Dang xuat
          </Button>
        </Space>
      </Header>

      <Content className="mx-auto w-full max-w-7xl px-4 py-6">
        <Space direction="vertical" size={8} className="mb-4" style={{ width: "100%" }}>
          <Text type="secondary">{description}</Text>
          <Text strong style={{ fontSize: 20 }}>
            {title}
          </Text>
        </Space>
        {children}
      </Content>
    </Layout>
  );
}