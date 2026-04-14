"use client";

import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Statistic, Table, Tabs, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { Category, Product, ProductOption, ProductOptionValue, ProductVariant, RoleId, User } from "@/types";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { ProductBrowser } from "@/components/product-browser";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";

interface ProductForm {
  name: string;
  description?: string;
  category_id: number;
  discount?: number;
}

interface VariantForm {
  product_id: number;
  sku_code: string;
  price: number;
  stock: number;
}

interface OptionValueForm {
  option_id: number;
  value: string;
}

type InventoryRow = ProductVariant & { product_name?: string };

export default function SellerPage() {
  const { message } = AntApp.useApp();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [buyers, setBuyers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [optionProductId, setOptionProductId] = useState<number | null>(null);
  const [optionChoices, setOptionChoices] = useState<ProductOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [optionSearchText, setOptionSearchText] = useState("");
  const [newOptionValue, setNewOptionValue] = useState("");
  const [selectedOptionValues, setSelectedOptionValues] = useState<ProductOptionValue[]>([]);
  const [productForm] = Form.useForm<ProductForm>();
  const [variantForm] = Form.useForm<VariantForm>();

  const loadData = async () => {
    if (!currentUser) {
      return;
    }

    const [sellerProductData, buyerData, categoryData] = await Promise.all([
      api.get<Product[]>(`/api/products/by-seller/${currentUser.id}`),
      api.get<User[]>("/api/admin/users/by-role/3"),
      api.get<Category[]>("/api/admin/categories"),
    ]);

    const inventoryData = await Promise.all(
      sellerProductData.map(async (product) => {
        const variants = await api.get<ProductVariant[]>(`/api/product-variants/by-product/${product.id}`);
        return variants.map((variant) => ({
          ...variant,
          product_name: product.name,
        }));
      }),
    );

    setSellerProducts(sellerProductData);
    setBuyers(buyerData);
    setCategories(categoryData);
    setInventory(inventoryData.flat());
  };

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const createSellerProduct = async (values: ProductForm) => {
    if (!currentUser) {
      return;
    }

    setLoading(true);
    try {
      await api.post<
        Product,
        {
          name: string;
          seller_id: number;
          category_id: number;
          description?: string;
          discount: number;
        }
      >("/api/products", {
        name: values.name,
        description: values.description,
        category_id: values.category_id,
        seller_id: currentUser.id,
        discount: values.discount ?? 0,
      });

      message.success("Tao san pham thanh cong");
      productForm.resetFields();
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createVariant = async (values: VariantForm) => {
    setLoading(true);
    try {
      await api.post<ProductVariant, VariantForm>("/api/product-variants", values);
      message.success("Da them bien the");
      variantForm.resetFields();
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOptionsByProduct = async (productId: number) => {
    const optionData = await api.get<ProductOption[]>(`/api/product-options/by-product/${productId}`);
    setOptionChoices(optionData);
  };

  const loadValuesByOption = async (optionId: number) => {
    const valueData = await api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${optionId}`);
    setSelectedOptionValues(valueData);
  };

  const handleOptionProductChange = async (productId: number) => {
    setOptionProductId(productId);
    setSelectedOptionId(null);
    setOptionSearchText("");
    setNewOptionValue("");
    setSelectedOptionValues([]);

    setLoading(true);
    try {
      await loadOptionsByProduct(productId);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = async (optionId: number) => {
    setSelectedOptionId(optionId);
    const selected = optionChoices.find((option) => option.id === optionId);
    if (selected) {
      setOptionSearchText(selected.name);
    }

    setLoading(true);
    try {
      await loadValuesByOption(optionId);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOption = async () => {
    if (!optionProductId) {
      message.warning("Hay chon san pham truoc");
      return;
    }

    const optionName = optionSearchText.trim();
    if (!optionName) {
      message.warning("Hay nhap ten lua chon");
      return;
    }

    const existed = optionChoices.find((option) => option.name.toLowerCase() === optionName.toLowerCase());
    if (existed) {
      message.info("Lua chon da ton tai, da chon san lua chon nay");
      await handleOptionSelect(existed.id);
      return;
    }

    setLoading(true);
    try {
      const createdOption = await api.post<ProductOption, Pick<ProductOption, "product_id" | "name">>("/api/product-options", {
        product_id: optionProductId,
        name: optionName,
      });

      setOptionChoices((previous) => [...previous, createdOption]);
      setSelectedOptionId(createdOption.id);
      setSelectedOptionValues([]);
      setOptionSearchText(createdOption.name);
      message.success("Da them lua chon");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOptionValue = async () => {
    if (!selectedOptionId) {
      message.warning("Hay chon hoac tao lua chon truoc");
      return;
    }

    const value = newOptionValue.trim();
    if (!value) {
      message.warning("Hay nhap value");
      return;
    }

    const existed = selectedOptionValues.some((item) => item.value.toLowerCase() === value.toLowerCase());
    if (existed) {
      message.warning("Value nay da ton tai");
      return;
    }

    setLoading(true);
    try {
      const createdValue = await api.post<ProductOptionValue, OptionValueForm>("/api/product-option-values", {
        option_id: selectedOptionId,
        value,
      });

      setSelectedOptionValues((previous) => [...previous, createdValue]);
      setNewOptionValue("");
      message.success("Da them value cho lua chon");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGate allowedRoles={[2]}>
      <EcommerceShell title="Kho nguoi ban" description="Quan ly san pham, bien the va ton kho cua chinh ban; dong thoi co the xem giao dien nguoi mua o tab rieng.">
        <Tabs
          items={[
            {
              key: "warehouse",
              label: "Kho hang cua toi",
              children: (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card className="surface-card">
                        <Statistic title="San pham cua toi" value={sellerProducts.length} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card className="surface-card">
                        <Statistic title="Bien the ton kho" value={inventory.length} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card className="surface-card">
                        <Statistic title="Nguoi mua" value={buyers.length} />
                      </Card>
                    </Col>
                  </Row>

                  <Card className="surface-card" title="Them san pham moi" extra={<PlusOutlined />}>
                    <Form layout="vertical" form={productForm} onFinish={createSellerProduct}>
                      <Row gutter={12}>
                        <Col xs={24} md={12}>
                          <Form.Item name="name" label="Ten san pham" rules={[{ required: true }]}>
                            <Input placeholder="Ao thun premium" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="category_id" label="Danh muc" rules={[{ required: true }]}>
                            <Select
                              options={categories.map((category) => ({ value: category.id, label: category.name }))}
                              placeholder="Chon danh muc"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item name="description" label="Mo ta">
                            <Input.TextArea rows={3} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="discount" label="Discount (%)">
                            <InputNumber min={0} max={99} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button htmlType="submit" type="primary" icon={<PlusOutlined />} loading={loading}>
                        Them san pham
                      </Button>
                    </Form>
                  </Card>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card className="surface-card" title="Them lua chon san pham">
                        <Form layout="vertical">
                          <Form.Item label="San pham" required>
                            <Select
                              value={optionProductId ?? undefined}
                              options={sellerProducts.map((product) => ({ value: product.id, label: product.name }))}
                              onChange={(value) => {
                                void handleOptionProductChange(value);
                              }}
                              placeholder="Chon san pham"
                            />
                          </Form.Item>

                          <Form.Item label="Ten lua chon" required>
                            <Space.Compact style={{ width: "100%" }}>
                              <Select
                                showSearch
                                value={selectedOptionId ?? undefined}
                                options={optionChoices.map((option) => ({ value: option.id, label: option.name }))}
                                onChange={(value) => {
                                  void handleOptionSelect(value);
                                }}
                                onSearch={setOptionSearchText}
                                filterOption={(input, option) =>
                                  (option?.label ?? "")
                                    .toString()
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                                placeholder="Chon hoac go ten lua chon"
                                style={{ width: "100%" }}
                              />
                              <Button type="primary" onClick={() => void handleCreateOption()} disabled={!optionProductId} loading={loading}>
                                Them vao lua chon
                              </Button>
                            </Space.Compact>
                          </Form.Item>

                          <Form.Item label="Them value cho lua chon da chon" required>
                            <Space.Compact style={{ width: "100%" }}>
                              <Input
                                value={newOptionValue}
                                onChange={(event) => setNewOptionValue(event.target.value)}
                                placeholder="Red / Blue / XL / Cotton"
                                disabled={!selectedOptionId}
                              />
                              <Button
                                type="primary"
                                onClick={() => void handleAddOptionValue()}
                                disabled={!selectedOptionId}
                                loading={loading}
                              >
                                Them value
                              </Button>
                            </Space.Compact>
                          </Form.Item>

                          <Space wrap>
                            {selectedOptionValues.map((item) => (
                              <Tag color="blue" key={item.id}>
                                {item.value}
                              </Tag>
                            ))}
                            {selectedOptionId && selectedOptionValues.length === 0 && <Tag>Chua co value nao</Tag>}
                          </Space>
                        </Form>
                      </Card>
                    </Col>

                    <Col xs={24} lg={12}>
                      <Card className="surface-card" title="Them bien the">
                        <Form layout="vertical" form={variantForm} onFinish={createVariant}>
                          <Form.Item name="product_id" label="San pham" rules={[{ required: true }]}>
                            <Select
                              options={sellerProducts.map((product) => ({ value: product.id, label: product.name }))}
                              placeholder="Chon san pham"
                            />
                          </Form.Item>
                          <Form.Item name="sku_code" label="SKU" rules={[{ required: true }]}>
                            <Input placeholder="TSHIRT-L-RED" />
                          </Form.Item>
                          <Form.Item name="price" label="Gia" rules={[{ required: true }]}>
                            <InputNumber min={1000} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item name="stock" label="Ton kho" rules={[{ required: true }]}>
                            <InputNumber min={0} style={{ width: "100%" }} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={loading}>
                            Them bien the
                          </Button>
                        </Form>
                      </Card>
                    </Col>
                  </Row>

                  <Card className="surface-card" title="Ton kho hien tai">
                    <Table
                      rowKey="id"
                      dataSource={inventory}
                      pagination={{ pageSize: 8 }}
                      columns={[
                        { title: "San pham", dataIndex: "product_name" },
                        { title: "SKU", dataIndex: "sku_code" },
                        { title: "Gia", dataIndex: "price" },
                        {
                          title: "Ton kho",
                          dataIndex: "stock",
                          render: (value: number) => <Tag color={value > 0 ? "green" : "red"}>{value}</Tag>,
                        },
                      ]}
                    />
                  </Card>

                  <Card className="surface-card" title="Danh sach nguoi mua (role_id = 3)">
                    <Table
                      rowKey="id"
                      dataSource={buyers}
                      pagination={{ pageSize: 5 }}
                      columns={[
                        { title: "ID", dataIndex: "id" },
                        { title: "Ten", dataIndex: "name" },
                        { title: "Email", dataIndex: "email" },
                        { title: "Role", dataIndex: "role_id", render: (value: RoleId) => <Tag>{value}</Tag> },
                      ]}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: "buyer",
              label: "Giao dien nguoi mua",
              children: <ProductBrowser allowPurchase={false} />,
            },
          ]}
        />
      </EcommerceShell>
    </RoleGate>
  );
}