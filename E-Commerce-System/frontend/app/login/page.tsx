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

interface LoginResponse {
  user: User;
  access_token: string;
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
      // Gọi API bắt kiểu LoginResponse
      const res = await api.post<LoginResponse, LoginForm>("/api/auth/login", values);
      login(res.user, res.access_token);
      message.success(`Xin chao ${res.user.name}`);
      router.replace(getRoleHome(res.user.role_id));
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
      message.success("Dang ky thanh cong, hay dang nhap");
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
              <Title level={2}>Nen tang thuong mai dien tu theo role</Title>
              <Text type="secondary">Dang nhap de vao dung page theo vai tro cua ban.</Text>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Card className="surface-card" title="Dang nhap">
              <Form form={loginForm} layout="vertical" onFinish={handleLogin}>
                <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                  <Input placeholder="d@example.com" />
                </Form.Item>
                <Form.Item name="password" label="Mat khau" rules={[{ required: true }]}>
                  <Input.Password placeholder="123456" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  Dang nhap
                </Button>
                <Button block style={{ marginTop: 12 }} onClick={() => setRegisterVisible(true)}>
                  Dang ky
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal open={registerVisible} title="Dang ky tai khoan" onCancel={() => setRegisterVisible(false)} footer={null}>
        <Form form={registerForm} layout="vertical" onFinish={handleRegister} initialValues={{ role_id: 3 }}>
          <Form.Item name="name" label="Ho va ten" rules={[{ required: true }]}>
            <Input placeholder="Nguyen Van A" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input placeholder="a@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Mat khau" rules={[{ required: true }]}>
            <Input.Password placeholder="123456" />
          </Form.Item>
          <Form.Item name="role_id" label="Vai tro">
            <Select
              options={[
                { value: 3, label: "Nguoi mua" },
                { value: 2, label: "Nguoi ban" },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Tao tai khoan
          </Button>
        </Form>
      </Modal>
    </div>
  );
}