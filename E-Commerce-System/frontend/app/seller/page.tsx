"use client";

import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Col, Empty, Form, Input, InputNumber, List, Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { Category, Order, OrderItem, Product, ProductOption, ProductOptionValue, ProductVariant, RoleId, User } from "@/types";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { ProductBrowser } from "../../components/product-browser";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";

interface ProductForm {
  name: string;
  description?: string;
  category_id: number;
  discount?: number;
  seller_id?: number;
}

interface OptionValueForm {
  option_id: number;
  value: string;
}

interface VariantCreatePayload {
  product_id: number;
  sku_code: string;
  price: number;
  stock: number;
}

interface VariantAttributePayload {
  variant_id: number;
  option_value_id: number;
}

interface VariantUpdatePayload {
  price: number;
  stock: number;
}

interface VariantDraft {
  id: string;
  sku_code: string;
  price: number;
  stock: number;
  optionValueIds: Record<number, number | undefined>;
}

type InventoryRow = ProductVariant & { product_name?: string };
type OptionValuesByOptionId = Record<number, ProductOptionValue[]>;
type OrderWithItems = Order & { items: OrderItem[] };

async function fetchOrderItems(orderId: number): Promise<OrderItem[]> {
  const candidatePaths = [
    `/api/order-items/by-order/${orderId}`,
    `/api/order-items/by-order-id/${orderId}`,
    `/api/order-items/order/${orderId}`,
    `/api/order-items?order_id=${orderId}`,
  ];

  for (const path of candidatePaths) {
    try {
      const items = await api.get<OrderItem[]>(path);
      return items;
    } catch {
      // Try next endpoint shape.
    }
  }

  return [];
}

function createVariantDraft(optionIds: number[] = []): VariantDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sku_code: "",
    price: 0,
    stock: 0,
    optionValueIds: Object.fromEntries(optionIds.map((id) => [id, undefined])) as Record<number, number | undefined>,
  };
}

function sameCombination(left: number[] = [], right: number[] = []) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value) => right.includes(value));
}

function orderStatusColor(statusName?: string) {
  const normalized = (statusName ?? "").toLowerCase();
  if (normalized.includes("deliver")) {
    return "green";
  }
  if (normalized.includes("complete") || normalized.includes("done")) {
    return "green";
  }
  if (normalized.includes("cancel")) {
    return "red";
  }
  if (normalized.includes("pending")) {
    return "gold";
  }
  return "blue";
}

export default function SellerPage() {
  const { message } = AntApp.useApp();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [buyers, setBuyers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [sellerOrders, setSellerOrders] = useState<OrderWithItems[]>([]);
  const [productForm] = Form.useForm<ProductForm>();

  const [configProductId, setConfigProductId] = useState<number | null>(null);
  const [configOptions, setConfigOptions] = useState<ProductOption[]>([]);
  const [optionValuesByOptionId, setOptionValuesByOptionId] = useState<OptionValuesByOptionId>({});
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [optionSearchText, setOptionSearchText] = useState("");
  const [optionDropdownOpen, setOptionDropdownOpen] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [selectedOptionValues, setSelectedOptionValues] = useState<ProductOptionValue[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(null);
  const [editingInventoryPrice, setEditingInventoryPrice] = useState(0);
  const [editingInventoryStock, setEditingInventoryStock] = useState(0);

  const loadProductConfiguration = async (productId: number) => {
    const options = await api.get<ProductOption[]>(`/api/product-options/by-product/${productId}`);
    const valuesByOption = await Promise.all(
      options.map((option) => api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${option.id}`)),
    );

    const valuesMap = options.reduce<OptionValuesByOptionId>((accumulator, option, index) => {
      accumulator[option.id] = valuesByOption[index] ?? [];
      return accumulator;
    }, {});

    setConfigProductId(productId);
    setConfigOptions(options);
    setOptionValuesByOptionId(valuesMap);
    setSelectedOptionId(options[0]?.id ?? null);
    setOptionSearchText(options[0]?.name ?? "");
    setSelectedOptionValues(valuesMap[options[0]?.id ?? -1] ?? []);
    setNewOptionValue("");
    setVariantDrafts([createVariantDraft(options.map((option) => option.id))]);
  };

  const loadData = async () => {
    if (!currentUser) {
      return;
    }

    const [sellerProductData, buyerData, categoryData, orderData] = await Promise.all([
      api.get<Product[]>(`/api/products/by-seller/${currentUser.id}`),
      api.get<User[]>("/api/admin/users/by-role/3"),
      api.get<Category[]>("/api/admin/categories"),
      api.get<Order[]>(`/api/orders/by-seller/${currentUser.id}`),
    ]);

    const orderWithItemsData = await Promise.all(
      orderData.map(async (order) => ({
        ...order,
        items: await fetchOrderItems(order.id),
      })),
    );

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
    setSellerOrders(orderWithItemsData);
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
      const createdProduct = await api.post<Product, ProductForm>("/api/products", {
        ...values,
        seller_id: currentUser.id,
        discount: values.discount ?? 0,
      });

      message.success("Da tao san pham");
      productForm.resetFields();
      await loadData();
      if (createdProduct?.id) {
        await loadProductConfiguration(createdProduct.id);
      }
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = async (productId: number) => {
    setConfigProductId(productId);
    setLoading(true);
    try {
      await loadProductConfiguration(productId);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionPick = async (optionId: number) => {
    setSelectedOptionId(optionId);
    const selected = configOptions.find((option) => option.id === optionId);
    if (selected) {
      setOptionSearchText(selected.name);
    }
    setOptionDropdownOpen(false);

    setLoading(true);
    try {
      const valueData = await api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${optionId}`);
      setSelectedOptionValues(valueData);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createOptionIfNeeded = async () => {
    if (!configProductId) {
      message.warning("Hay chon san pham truoc");
      return;
    }

    const name = optionSearchText.trim();
    if (!name) {
      message.warning("Hay nhap ten lua chon");
      return;
    }

    const exactMatch = configOptions.find((option) => option.name.toLowerCase() === name.toLowerCase());
    if (exactMatch) {
      await handleOptionPick(exactMatch.id);
      return;
    }

    setLoading(true);
    try {
      const createdOption = await api.post<ProductOption, Pick<ProductOption, "product_id" | "name">>("/api/product-options", {
        product_id: configProductId,
        name,
      });

      setConfigOptions((previous) => [...previous, createdOption]);
      setSelectedOptionId(createdOption.id);
      setOptionSearchText(createdOption.name);
      setSelectedOptionValues([]);
      setOptionValuesByOptionId((previous) => ({
        ...previous,
        [createdOption.id]: [],
      }));
      setOptionDropdownOpen(false);
      message.success("Da them lua chon");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addValueToSelectedOption = async () => {
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
      setOptionValuesByOptionId((previous) => ({
        ...previous,
        [selectedOptionId]: [...(previous[selectedOptionId] ?? []), createdValue],
      }));
      setNewOptionValue("");
      message.success("Da them value cho lua chon");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addVariantDraft = () => {
    if (!configProductId) {
      message.warning("Hay chon san pham truoc");
      return;
    }

    setVariantDrafts((previous) => [...previous, createVariantDraft(configOptions.map((option) => option.id))]);
  };

  const updateVariantDraft = (draftId: string, updater: (draft: VariantDraft) => VariantDraft) => {
    setVariantDrafts((previous) => previous.map((draft) => (draft.id === draftId ? updater(draft) : draft)));
  };

  const removeVariantDraft = (draftId: string) => {
    setVariantDrafts((previous) => previous.filter((draft) => draft.id !== draftId));
  };

  const createVariant = async (draft: VariantDraft) => {
    if (!configProductId) {
      message.warning("Hay chon san pham truoc");
      return;
    }

    const optionValueIds = configOptions
      .map((option) => draft.optionValueIds[option.id])
      .filter((value): value is number => typeof value === "number");

    if (!draft.sku_code.trim()) {
      message.warning("Hay nhap SKU");
      return;
    }

    const duplicate = inventory.some((variant) => sameCombination(variant.option_value_ids ?? [], optionValueIds));
    if (duplicate) {
      message.warning("Bien the nay da ton tai");
      return;
    }

    setLoading(true);
    try {
      const createdVariant = await api.post<ProductVariant, VariantCreatePayload>("/api/product-variants", {
        product_id: configProductId,
        sku_code: draft.sku_code.trim(),
        price: draft.price,
        stock: draft.stock,
      });

      if (!createdVariant?.id) {
        throw new Error("Khong nhan duoc id bien the sau khi tao");
      }

      await Promise.all(
        optionValueIds.map((optionValueId) =>
          api.post<unknown, VariantAttributePayload>("/api/variant-attributes", {
            variant_id: createdVariant.id,
            option_value_id: optionValueId,
          }),
        ),
      );

      message.success("Da them bien the");
      await loadData();
      await loadProductConfiguration(configProductId);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditInventory = (variant: InventoryRow) => {
    setEditingInventoryId(variant.id);
    setEditingInventoryPrice(variant.price);
    setEditingInventoryStock(variant.stock);
  };

  const cancelEditInventory = () => {
    setEditingInventoryId(null);
    setEditingInventoryPrice(0);
    setEditingInventoryStock(0);
  };

  const saveInventoryRow = async (variantId: number) => {
    if (editingInventoryPrice < 0 || editingInventoryStock < 0) {
      message.warning("Gia va ton kho phai >= 0");
      return;
    }

    setLoading(true);
    try {
      await api.patch<ProductVariant, VariantUpdatePayload>(`/api/product-variants/${variantId}`, {
        price: editingInventoryPrice,
        stock: editingInventoryStock,
      });

      message.success("Da cap nhat bien the");
      cancelEditInventory();
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteInventoryRow = async (variantId: number) => {
    setLoading(true);
    try {
      await api.del<{ id: number }>(`/api/product-variants/${variantId}`);
      message.success("Da xoa bien the");
      if (editingInventoryId === variantId) {
        cancelEditInventory();
      }
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSellerOrder = async (orderId: number) => {
    setLoading(true);
    try {
      await api.del<{ id: number }>(`/api/orders/${orderId}`);
      message.success("Da xoa don hang");
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizedOptionSearchText = optionSearchText.trim().toLowerCase();
  const filteredOptions = configOptions.filter((option) => option.name.toLowerCase().includes(normalizedOptionSearchText));
  const showCreateOptionButton = normalizedOptionSearchText !== "" && filteredOptions.length === 0;

  return (
    <RoleGate allowedRoles={[2]}>
      <EcommerceShell title="Quan ly nguoi ban" description="Tao san pham, cau hinh option/value, them bien the, quan ly ton kho va don hang cua ban.">
        <Tabs
          items={[
            {
              key: "warehouse",
              label: "Quan ly cua toi",
              children: (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>                      <Card className="surface-card">
                      <Statistic title="San pham cua toi" value={sellerProducts.length} />
                    </Card>
                    </Col>
                    <Col xs={24} sm={12}>                      <Card className="surface-card">
                      <Statistic title="Don hang cua toi" value={sellerOrders.length} />
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

                  <Card className="surface-card" title="Cau hinh option va value" extra={<PlusOutlined />}>
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                      <Form layout="vertical">
                        <Form.Item label="San pham" required>
                          <Select
                            value={configProductId ?? undefined}
                            options={sellerProducts.map((product) => ({ value: product.id, label: product.name }))}
                            onChange={(value) => {
                              void handleProductChange(value as number);
                            }}
                            placeholder="Chon san pham"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                          />
                        </Form.Item>

                        <Form.Item label="Lua chon" required>
                          <Select
                            value={selectedOptionId ?? undefined}
                            showSearch
                            filterOption={false}
                            searchValue={optionSearchText}
                            open={optionDropdownOpen}
                            onOpenChange={(nextOpen) => setOptionDropdownOpen(nextOpen)}
                            onSearch={(value) => {
                              setOptionSearchText(value);
                            }}
                            onChange={(value) => {
                              if (typeof value !== "number") {
                                setSelectedOptionId(null);
                                setOptionSearchText("");
                                setSelectedOptionValues([]);
                                return;
                              }

                              void handleOptionPick(value);
                            }}
                            options={filteredOptions.map((option) => ({ value: option.id, label: option.name }))}
                            placeholder="Tim hoac chon lua chon"
                            style={{ width: "100%" }}
                            allowClear
                            notFoundContent="Khong co lua chon phu hop"
                            popupRender={(menu) => (
                              <Space direction="vertical" style={{ width: "100%", padding: 8 }}>
                                {menu}
                                {showCreateOptionButton && (
                                  <Button
                                    type="primary"
                                    block
                                    loading={loading}
                                    disabled={!configProductId}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => void createOptionIfNeeded()}
                                  >
                                    Them lua chon
                                  </Button>
                                )}
                              </Space>
                            )}
                          />
                        </Form.Item>

                        <Form.Item label="Them value cho lua chon da chon" required>
                          <Space.Compact style={{ width: "100%" }}>
                            <Input
                              value={newOptionValue}
                              onChange={(event) => setNewOptionValue(event.target.value)}
                              placeholder="Red / Blue / XL / Cotton"
                              disabled={!selectedOptionId}
                            />
                            <Button type="primary" onClick={() => void addValueToSelectedOption()} disabled={!selectedOptionId} loading={loading}>
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
                    </Space>
                  </Card>

                  <Card className="surface-card" title="Them bien the" extra={<Button onClick={addVariantDraft}>Them dong bien the</Button>}>
                    {configProductId ? (
                      <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        {configOptions.length > 0 ? (
                          variantDrafts.map((draft, index) => {
                            const selectedLabels = configOptions
                              .map((option) => {
                                const valueId = draft.optionValueIds[option.id];
                                const value = optionValuesByOptionId[option.id]?.find((item) => item.id === valueId);
                                return value ? `${option.name}: ${value.value}` : null;
                              })
                              .filter((value): value is string => value !== null);

                            return (
                              <Card
                                key={draft.id}
                                size="small"
                                title={`Bien the ${index + 1}`}
                                extra={
                                  <Button danger onClick={() => removeVariantDraft(draft.id)}>
                                    Xoa dong
                                  </Button>
                                }
                              >
                                <Row gutter={[12, 12]}>
                                  <Col xs={24} md={8}>
                                    <Input
                                      value={draft.sku_code}
                                      onChange={(event) =>
                                        updateVariantDraft(draft.id, (previous) => ({
                                          ...previous,
                                          sku_code: event.target.value,
                                        }))
                                      }
                                      placeholder="SKU code"
                                    />
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <InputNumber
                                      min={0}
                                      value={draft.price}
                                      onChange={(value) =>
                                        updateVariantDraft(draft.id, (previous) => ({
                                          ...previous,
                                          price: value || 0,
                                        }))
                                      }
                                      placeholder="Gia"
                                      style={{ width: "100%" }}
                                    />
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <InputNumber
                                      min={0}
                                      value={draft.stock}
                                      onChange={(value) =>
                                        updateVariantDraft(draft.id, (previous) => ({
                                          ...previous,
                                          stock: value || 0,
                                        }))
                                      }
                                      placeholder="Ton kho"
                                      style={{ width: "100%" }}
                                    />
                                  </Col>

                                  {configOptions.map((option) => (
                                    <Col xs={24} md={12} key={option.id}>
                                      <Select
                                        value={draft.optionValueIds[option.id]}
                                        onChange={(value) =>
                                          updateVariantDraft(draft.id, (previous) => ({
                                            ...previous,
                                            optionValueIds: {
                                              ...previous.optionValueIds,
                                              [option.id]: value,
                                            },
                                          }))
                                        }
                                        placeholder={`Chon ${option.name}`}
                                        options={(optionValuesByOptionId[option.id] ?? []).map((value) => ({
                                          value: value.id,
                                          label: `${value.value}`,
                                        }))}
                                      />
                                    </Col>
                                  ))}

                                  <Col xs={24}>
                                    <Space wrap>
                                      {selectedLabels.map((label) => (
                                        <Tag key={label}>{label}</Tag>
                                      ))}
                                    </Space>
                                  </Col>

                                  <Col xs={24}>
                                    <Button type="primary" onClick={() => void createVariant(draft)} loading={loading}>
                                      Luu bien the
                                    </Button>
                                  </Col>
                                </Row>
                              </Card>
                            );
                          })
                        ) : (
                          <Empty description="Hay them option truoc khi tao bien the" />
                        )}
                      </Space>
                    ) : (
                      <Empty description="Hay chon san pham de quan ly option va bien the" />
                    )}
                  </Card>

                  <Card className="surface-card" title="Ton kho hien tai">
                    <Table
                      rowKey="id"
                      dataSource={inventory}
                      pagination={{ pageSize: 8 }}
                      columns={[
                        { title: "San pham", dataIndex: "product_name" },
                        { title: "SKU", dataIndex: "sku_code" },
                        {
                          title: "Gia",
                          dataIndex: "price",
                          render: (value: number, record: InventoryRow) =>
                            editingInventoryId === record.id ? (
                              <InputNumber
                                min={0}
                                value={editingInventoryPrice}
                                onChange={(nextValue) => setEditingInventoryPrice(nextValue || 0)}
                              />
                            ) : (
                              value
                            ),
                        },
                        {
                          title: "Ton kho",
                          dataIndex: "stock",
                          render: (value: number, record: InventoryRow) =>
                            editingInventoryId === record.id ? (
                              <InputNumber
                                min={0}
                                value={editingInventoryStock}
                                onChange={(nextValue) => setEditingInventoryStock(nextValue || 0)}
                              />
                            ) : (
                              <Tag color={value > 0 ? "green" : "red"}>{value}</Tag>
                            ),
                        },
                        {
                          title: "Thao tac",
                          key: "actions",
                          render: (_: unknown, record: InventoryRow) =>
                            editingInventoryId === record.id ? (
                              <Space>
                                <Button type="primary" size="small" loading={loading} onClick={() => void saveInventoryRow(record.id)}>
                                  Luu
                                </Button>
                                <Button size="small" onClick={cancelEditInventory} disabled={loading}>
                                  Huy
                                </Button>
                              </Space>
                            ) : (
                              <Space>
                                <Button size="small" onClick={() => startEditInventory(record)} disabled={loading}>
                                  Sua
                                </Button>
                                <Popconfirm
                                  title="Xoa bien the nay?"
                                  okText="Xoa"
                                  cancelText="Huy"
                                  onConfirm={() => void deleteInventoryRow(record.id)}
                                  disabled={loading}
                                >
                                  <Button size="small" danger disabled={loading}>
                                    Xoa
                                  </Button>
                                </Popconfirm>
                              </Space>
                            ),
                        },
                      ]}
                    />
                  </Card>

                  <Card className="surface-card" title="Don hang cua toi">
                    <Table
                      rowKey="id"
                      dataSource={sellerOrders}
                      pagination={{ pageSize: 8 }}
                      expandable={{
                        expandedRowRender: (record) => (
                          <List
                            size="small"
                            dataSource={record.items}
                            locale={{ emptyText: "Don hang nay chua co san pham" }}
                            renderItem={(item) => (
                              <List.Item>
                                <span>{`${item.product_name || "San pham"} | SKU: ${item.variant_sku_code || item.variant_id} | ${item.unit_price} x ${item.quantity}`}</span>
                              </List.Item>
                            )}
                          />
                        ),
                        rowExpandable: (record) => record.items.length > 0,
                      }}
                      columns={[
                        { title: "ID", dataIndex: "id" },
                        { title: "Khach hang", dataIndex: "user_name", render: (value: string | undefined, record: OrderWithItems) => value || record.user_email || `User #${record.user_id}` },
                        { title: "Tong tien", dataIndex: "total_price" },
                        {
                          title: "Trang thai",
                          dataIndex: "status_name",
                          render: (value: string | undefined) => <Tag color={orderStatusColor(value)}>{value || "unknown"}</Tag>,
                        },
                        { title: "So san pham", dataIndex: "items_count", render: (value: number | undefined) => value ?? 0 },
                        { title: "Tao luc", dataIndex: "created_at" },
                        {
                          title: "Thao tac",
                          key: "actions",
                          render: (_: unknown, record: OrderWithItems) => (
                            <Popconfirm
                              title="Xoa don hang nay?"
                              description="Thao tac nay khong the hoan tac"
                              okText="Xoa"
                              cancelText="Huy"
                              onConfirm={() => void deleteSellerOrder(record.id)}
                              disabled={loading}
                            >
                              <Button size="small" danger disabled={loading}>
                                Xoa
                              </Button>
                            </Popconfirm>
                          ),
                        },
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
