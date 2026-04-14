"use client";

import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Col, Form, Input, Row, Select, Space, Statistic, Table, Tag } from "antd";
import { api } from "@/lib/api";
import { Category, Product, RoleId, User } from "@/types";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { RoleGate } from "@/components/role-gate";

interface AdminUserForm {
  name: string;
  email: string;
  password: string;
  role_id: RoleId;
}

interface CategoryForm {
  name: string;
}

export default function AdminPage() {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminUserForm] = Form.useForm<AdminUserForm>();
  const [adminCategoryForm] = Form.useForm<CategoryForm>();

  const loadData = async () => {
    const [productData, categoryData, userData] = await Promise.all([
      api.get<Product[]>("/api/products"),
      api.get<Category[]>("/api/admin/categories"),
      api.get<User[]>("/api/admin/users"),
    ]);

    setProducts(productData);
    setCategories(categoryData);
    setUsers(userData);
  };

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const createAdminUser = async (values: AdminUserForm) => {
    setLoading(true);
    try {
      await api.post<User, AdminUserForm>("/api/admin/users", values);
      message.success("Da tao nguoi dung");
      adminUserForm.resetFields();
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (values: CategoryForm) => {
    setLoading(true);
    try {
      await api.post<Category, CategoryForm>("/api/admin/categories", values);
      message.success("Da tao danh muc");
      adminCategoryForm.resetFields();
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGate allowedRoles={[1]}>
      <EcommerceShell title="Quan tri toan he thong" description="Admin quan ly toan bo nguoi dung, danh muc va san pham.">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card className="surface-card">
                <Statistic title="Tong san pham" value={products.length} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="surface-card">
                <Statistic title="Tong danh muc" value={categories.length} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="surface-card">
                <Statistic title="Tong user" value={users.length} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card className="surface-card" title="Tao nguoi dung">
                <Form layout="vertical" form={adminUserForm} onFinish={createAdminUser}>
                  <Form.Item name="name" label="Ten" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="Mat khau" rules={[{ required: true }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 1, label: "Admin" },
                        { value: 2, label: "Nguoi ban" },
                        { value: 3, label: "Nguoi mua" },
                      ]}
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Tao user
                  </Button>
                </Form>
              </Card>
            </Col>

            <Col xs={24} xl={12}>
              <Card className="surface-card" title="Tao danh muc san pham">
                <Form layout="vertical" form={adminCategoryForm} onFinish={createCategory}>
                  <Form.Item name="name" label="Ten danh muc" rules={[{ required: true }]}>
                    <Input placeholder="Fashion" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Tao danh muc
                  </Button>
                </Form>
              </Card>
            </Col>
          </Row>

          <Card className="surface-card" title="Quan ly nguoi dung">
            <Table
              rowKey="id"
              dataSource={users}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: "ID", dataIndex: "id" },
                { title: "Ten", dataIndex: "name" },
                { title: "Email", dataIndex: "email" },
                {
                  title: "Role",
                  dataIndex: "role_id",
                  render: (value: number) => {
                    const color = value === 1 ? "red" : value === 2 ? "blue" : "green";
                    return <Tag color={color}>role {value}</Tag>;
                  },
                },
              ]}
            />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card className="surface-card" title="Danh muc">
                <Table
                  rowKey="id"
                  dataSource={categories}
                  pagination={false}
                  columns={[
                    { title: "ID", dataIndex: "id" },
                    { title: "Ten danh muc", dataIndex: "name" },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card className="surface-card" title="San pham">
                <Table
                  rowKey="id"
                  dataSource={products}
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: "ID", dataIndex: "id" },
                    { title: "Ten", dataIndex: "name" },
                    { title: "Category", dataIndex: "category_name" },
                    { title: "Seller", dataIndex: "seller_name" },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </Space>
      </EcommerceShell>
    </RoleGate>
  );
}