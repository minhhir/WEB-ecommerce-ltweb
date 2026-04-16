"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App as AntApp, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Typography } from "antd";
import { api } from "@/lib/api";
import { RoleId, User } from "@/types";
import { getRoleHome, useSession } from "@/components/session-provider";

const { Title, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  role_id: RoleId;
}

export default function LoginPage() {
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { currentUser, login, ready } = useSession();
  const [loading, setLoading] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [loginForm] = Form.useForm<LoginForm>();
  const [registerForm] = Form.useForm<RegisterForm>();

  useEffect(() => {
    if (ready && currentUser) {
      router.replace(getRoleHome(currentUser.role_id));
    }
  }, [currentUser, ready, router]);

  const handleLogin = async (values: LoginForm) => {
    setLoading(true);
    try {
      const user = await api.post<User, LoginForm>("/api/auth/login", values);
      login(user);
      message.success(`Xin chào ${user.name}`);
      router.replace(getRoleHome(user.role_id));
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterForm) => {
    setLoading(true);
    try {
      await api.post<User, RegisterForm>("/api/auth/register", values);
      message.success("Đăng ký thành công, bạn có thể đăng nhập ngay bây giờ");
      registerForm.resetFields();
      setRegisterVisible(false);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12">
      <Card className="hero-glow w-full rounded-2xl border-0 p-2">
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={8}>
              <Title level={2}>Nền tảng thương mại điện tử</Title>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Card className="surface-card" title="Đăng nhập">
              <Form form={loginForm} layout="vertical" onFinish={handleLogin}>
                <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                  <Input placeholder="d@example.com" />
                </Form.Item>
                <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
                  <Input.Password placeholder="123456" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  Đăng nhập
                </Button>
                <Button block style={{ marginTop: 12 }} onClick={() => setRegisterVisible(true)}>
                  Đăng ký
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal open={registerVisible} title="Đăng ký tài khoản" onCancel={() => setRegisterVisible(false)} footer={null}>
        <Form form={registerForm} layout="vertical" onFinish={handleRegister} initialValues={{ role_id: 3 }}>
          <Form.Item name="name" label="Họ và tên" rules={[{ required: true }]}>
            <Input placeholder="Nguyen Van A" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input placeholder="a@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password placeholder="123456" />
          </Form.Item>
          <Form.Item name="role_id" label="Vai trò">
            <Select
              options={[
                { value: 3, label: "Người mua" },
                { value: 2, label: "Người bán" },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Đăng ký
          </Button>
        </Form>
      </Modal>
    </div>
  );
}