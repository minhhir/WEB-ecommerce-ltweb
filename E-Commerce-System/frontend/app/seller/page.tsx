"use client";

import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Col, Empty, Form, Input, InputNumber, List, Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { Category, Order, OrderItem, Product, ProductOption, ProductOptionValue, ProductVariant } from "@/types";
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

interface ProductUpdatePayload {
  name: string;
  description?: string;
  category_id: number;
  discount?: number;
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
  option_value_id: number | null;
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
      // Thử endpoint tiếp theo
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

function orderStatusColor(statusName?: string) {
  const normalized = (statusName ?? "").toLowerCase();
  if (normalized.includes("deliver") || normalized.includes("giao")) {
    return "green";
  }
  if (normalized.includes("complete") || normalized.includes("done") || normalized.includes("xong")) {
    return "green";
  }
  if (normalized.includes("cancel") || normalized.includes("hủy")) {
    return "red";
  }
  if (normalized.includes("pending") || normalized.includes("chờ")) {
    return "gold";
  }
  return "blue";
}

export default function SellerPage() {
  const { message } = AntApp.useApp();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [sellerOrders, setSellerOrders] = useState<OrderWithItems[]>([]);
  const [productForm] = Form.useForm<ProductForm>();
  const [productEditForm] = Form.useForm<ProductForm>();
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

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
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<number[]>([]);
  const [selectedSellerOrderIds, setSelectedSellerOrderIds] = useState<number[]>([]);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImageInputKey, setProductImageInputKey] = useState(0);

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

    const [sellerProductData, categoryData, orderData] = await Promise.all([
      api.get<Product[]>(`/api/products/by-seller/${currentUser.id}`),
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
    setCategories(categoryData);
    setInventory(inventoryData.flat());
    setSellerOrders(orderWithItemsData);

    setSelectedProductIds((previous) => previous.filter((id) => sellerProductData.some((product) => product.id === id)));
    setSelectedInventoryIds((previous) => previous.filter((id) => inventoryData.flat().some((variant) => variant.id === id)));
    setSelectedSellerOrderIds((previous) => previous.filter((id) => orderWithItemsData.some((order) => order.id === id)));
  };

  useEffect(() => {
    setLoading(true);
    void loadData()
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [currentUser, message]);

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

      if (createdProduct?.id && productImageFile) {
        const formData = new FormData();
        formData.append("image", productImageFile);
        await api.postFormData<unknown>(`/api/products/${createdProduct.id}/image`, formData);
      }

      message.success("Đã tạo sản phẩm");
      productForm.resetFields();
      setProductImageFile(null);
      setProductImageInputKey((previous) => previous + 1);
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

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    productEditForm.setFieldsValue({
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      discount: product.discount ?? 0,
    });
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    productEditForm.resetFields();
  };

  const updateSellerProduct = async (values: ProductForm) => {
    if (!editingProductId) {
      message.warning("Vui lòng chọn sản phẩm cần sửa");
      return;
    }

    setLoading(true);
    try {
      await api.patch<Product, ProductUpdatePayload>(`/api/products/${editingProductId}`, {
        name: values.name,
        description: values.description,
        category_id: values.category_id,
        discount: values.discount ?? 0,
      });

      message.success("Đã cập nhật sản phẩm");
      cancelEditProduct();
      await loadData();
      if (configProductId === editingProductId) {
        await loadProductConfiguration(editingProductId);
      }
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSellerProduct = async (productId: number) => {
    setLoading(true);
    try {
      await api.del<{ id: number }>(`/api/products/${productId}`);
      message.success("Đã xóa sản phẩm");

      if (editingProductId === productId) {
        cancelEditProduct();
      }

      if (configProductId === productId) {
        setConfigProductId(null);
        setConfigOptions([]);
        setOptionValuesByOptionId({});
        setSelectedOptionId(null);
        setOptionSearchText("");
        setSelectedOptionValues([]);
        setVariantDrafts([]);
      }

      await loadData();
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
      message.warning("Vui lòng chọn sản phẩm trước");
      return;
    }

    const name = optionSearchText.trim();
    if (!name) {
      message.warning("Vui lòng nhập tên tùy chọn");
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
      message.success("Đã thêm tùy chọn");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addValueToSelectedOption = async () => {
    if (!selectedOptionId) {
      message.warning("Vui lòng chọn hoặc tạo tùy chọn trước");
      return;
    }

    const value = newOptionValue.trim();
    if (!value) {
      message.warning("Vui lòng nhập giá trị");
      return;
    }

    const existed = selectedOptionValues.some((item) => item.value.toLowerCase() === value.toLowerCase());
    if (existed) {
      message.warning("Giá trị này đã tồn tại");
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
      message.success("Đã thêm giá trị cho tùy chọn");
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addVariantDraft = () => {
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
      message.warning("Vui lòng chọn sản phẩm trước");
      return;
    }

    if (!draft.sku_code.trim()) {
      message.warning("Vui lòng nhập mã SKU");
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
        throw new Error("Không nhận được ID biến thể sau khi tạo");
      }

      // Luôn tạo variant_attributes: nếu không chọn option nào thì gửi option_value_id = null
      const optionValueIds = configOptions
        .map((option) => draft.optionValueIds[option.id])
        .filter((value): value is number => typeof value === "number");

      if (optionValueIds.length === 0) {
        await api.post<unknown, VariantAttributePayload>("/api/variant-attributes", {
          variant_id: createdVariant.id,
          option_value_id: null,
        });
      } else {
        await Promise.all(
          optionValueIds.map((optionValueId) =>
            api.post<unknown, VariantAttributePayload>("/api/variant-attributes", {
              variant_id: createdVariant.id,
              option_value_id: optionValueId,
            }),
          ),
        );
      }

      message.success("Đã thêm biến thể");
      await loadData();
      if (configProductId) {
        await loadProductConfiguration(configProductId);
      }
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
      message.warning("Giá và tồn kho phải >= 0");
      return;
    }

    setLoading(true);
    try {
      await api.patch<ProductVariant, VariantUpdatePayload>(`/api/product-variants/${variantId}`, {
        price: editingInventoryPrice,
        stock: editingInventoryStock,
      });

      message.success("Đã cập nhật biến thể");
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
      message.success("Đã xóa biến thể");
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
      message.success("Đã xóa đơn hàng");
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedProducts = async () => {
    if (selectedProductIds.length === 0) {
      message.warning("Vui lòng chọn sản phẩm cần xóa");
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(selectedProductIds.map((productId) => api.del<{ id: number }>(`/api/products/${productId}`)));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        message.success(`Đã xóa ${successCount} sản phẩm`);
      }
      if (failedCount > 0) {
        message.error(`${failedCount} sản phẩm xóa thất bại`);
      }

      if (editingProductId && selectedProductIds.includes(editingProductId)) {
        cancelEditProduct();
      }

      if (configProductId && selectedProductIds.includes(configProductId)) {
        setConfigProductId(null);
        setConfigOptions([]);
        setOptionValuesByOptionId({});
        setSelectedOptionId(null);
        setOptionSearchText("");
        setSelectedOptionValues([]);
        setVariantDrafts([]);
      }

      setSelectedProductIds([]);
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedInventory = async () => {
    if (selectedInventoryIds.length === 0) {
      message.warning("Vui lòng chọn biến thể cần xóa");
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(selectedInventoryIds.map((variantId) => api.del<{ id: number }>(`/api/product-variants/${variantId}`)));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        message.success(`Đã xóa ${successCount} biến thể`);
      }
      if (failedCount > 0) {
        message.error(`${failedCount} biến thể xóa thất bại`);
      }

      if (editingInventoryId && selectedInventoryIds.includes(editingInventoryId)) {
        cancelEditInventory();
      }

      setSelectedInventoryIds([]);
      await loadData();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedSellerOrders = async () => {
    if (selectedSellerOrderIds.length === 0) {
      message.warning("Vui lòng chọn đơn hàng cần xóa");
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(selectedSellerOrderIds.map((orderId) => api.del<{ id: number }>(`/api/orders/${orderId}`)));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        message.success(`Đã xóa ${successCount} đơn hàng`);
      }
      if (failedCount > 0) {
        message.error(`${failedCount} đơn hàng xóa thất bại`);
      }

      setSelectedSellerOrderIds([]);
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

  const tabItems = [
    {
      key: "warehouse",
      label: "Quản lý của tôi",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card className="surface-card">
                <Statistic title="Sản phẩm của tôi" value={sellerProducts.length} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card className="surface-card">
                <Statistic title="Đơn hàng của tôi" value={sellerOrders.length} />
              </Card>
            </Col>
          </Row>

          <Card className="surface-card" title="Thêm sản phẩm mới" extra={<PlusOutlined />}>
            <Form layout="vertical" form={productForm} onFinish={createSellerProduct}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
                    <Input placeholder="Áo thun premium" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="category_id" label="Danh mục" rules={[{ required: true }]}>
                    <Select
                      options={categories.map((category) => ({ value: category.id, label: category.name }))}
                      placeholder="Chọn danh mục"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="description" label="Mô tả">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="discount" label="Giảm giá (%)">
                    <InputNumber min={0} max={99} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Ảnh sản phẩm">
                    <Input
                      key={productImageInputKey}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        setProductImageFile(nextFile);
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Button htmlType="submit" type="primary" icon={<PlusOutlined />} loading={loading}>
                Thêm sản phẩm
              </Button>
            </Form>
          </Card>

          <Card
            className="surface-card"
            title="Quản lý sản phẩm"
            extra={
              <Popconfirm
                title="Xóa các sản phẩm đã chọn?"
                description={`Đang chọn ${selectedProductIds.length} sản phẩm`}
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={() => void deleteSelectedProducts()}
                disabled={loading || selectedProductIds.length === 0}
              >
                <Button danger disabled={loading || selectedProductIds.length === 0}>
                  Xóa đã chọn ({selectedProductIds.length})
                </Button>
              </Popconfirm>
            }
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Table
                rowKey="id"
                dataSource={sellerProducts}
                pagination={{ pageSize: 6 }}
                rowSelection={{
                  selectedRowKeys: selectedProductIds,
                  onChange: (selectedRowKeys) => setSelectedProductIds(selectedRowKeys as number[]),
                }}
                columns={[
                  { title: "ID", dataIndex: "id", width: 80 },
                  { title: "Tên sản phẩm", dataIndex: "name" },
                  {
                    title: "Danh mục",
                    dataIndex: "category_id",
                    render: (value: number, record: Product) => {
                      if (record.category_name) {
                        return record.category_name;
                      }

                      return categories.find((category) => category.id === value)?.name ?? `#${value}`;
                    },
                  },
                  {
                    title: "Giảm giá (%)",
                    dataIndex: "discount",
                    render: (value: number | undefined) => value ?? 0,
                  },
                  {
                    title: "Thao tác",
                    key: "actions",
                    render: (_: unknown, record: Product) => (
                      <Space>
                        <Button size="small" onClick={() => startEditProduct(record)} disabled={loading}>
                          Sửa
                        </Button>
                        <Popconfirm
                          title="Xóa sản phẩm này?"
                          description="Các biến thể liên quan có thể bị ảnh hưởng"
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() => void deleteSellerProduct(record.id)}
                          disabled={loading}
                        >
                          <Button size="small" danger disabled={loading}>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />

              <Card size="small" title="Sửa sản phẩm đã chọn">
                {editingProductId ? (
                  <Form layout="vertical" form={productEditForm} onFinish={updateSellerProduct}>
                    <Row gutter={12}>
                      <Col xs={24} md={12}>
                        <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
                          <Input placeholder="Tên sản phẩm" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="category_id" label="Danh mục" rules={[{ required: true }]}>
                          <Select
                            options={categories.map((category) => ({ value: category.id, label: category.name }))}
                            placeholder="Chọn danh mục"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="description" label="Mô tả">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="discount" label="Giảm giá (%)">
                          <InputNumber min={0} max={99} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Space>
                      <Button htmlType="submit" type="primary" loading={loading}>
                        Lưu thay đổi
                      </Button>
                      <Button onClick={cancelEditProduct} disabled={loading}>
                        Hủy
                      </Button>
                    </Space>
                  </Form>
                ) : (
                  <Empty description="Chọn một sản phẩm trong bảng để chỉnh sửa" />
                )}
              </Card>
            </Space>
          </Card>

          <Card className="surface-card" title="Cấu hình tùy chọn và giá trị" extra={<PlusOutlined />}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Form layout="vertical">
                <Form.Item label="Sản phẩm" required>
                  <Select
                    value={configProductId ?? undefined}
                    options={sellerProducts.map((product) => ({ value: product.id, label: product.name }))}
                    onChange={(value) => {
                      void handleProductChange(value as number);
                    }}
                    placeholder="Chọn sản phẩm"
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Form.Item>

                <Form.Item label="Tùy chọn">
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
                    placeholder="Tìm hoặc chọn tùy chọn"
                    style={{ width: "100%" }}
                    allowClear
                    notFoundContent="Không có tùy chọn phù hợp"
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
                            Thêm tùy chọn
                          </Button>
                        )}
                      </Space>
                    )}
                  />
                </Form.Item>

                <Form.Item label="Thêm giá trị cho tùy chọn đã chọn">
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      value={newOptionValue}
                      onChange={(event) => setNewOptionValue(event.target.value)}
                      placeholder="Đỏ / Xanh / XL / Cotton"
                      disabled={!selectedOptionId}
                    />
                    <Button type="primary" onClick={() => void addValueToSelectedOption()} disabled={!selectedOptionId} loading={loading}>
                      Thêm giá trị
                    </Button>
                  </Space.Compact>
                </Form.Item>

                <Space wrap>
                  {selectedOptionValues.map((item) => (
                    <Tag color="blue" key={item.id}>
                      {item.value}
                    </Tag>
                  ))}
                  {selectedOptionId && selectedOptionValues.length === 0 && <Tag>Chưa có giá trị nào</Tag>}
                </Space>
              </Form>
            </Space>
          </Card>

          <Card className="surface-card" title="Thêm biến thể sản phẩm" extra={<Button onClick={addVariantDraft}>Thêm dòng biến thể</Button>}>
            {configProductId ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {variantDrafts.map((draft, index) => {
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
                      title={`Biến thể ${index + 1}`}
                      extra={
                        <Button danger onClick={() => removeVariantDraft(draft.id)}>
                          Xóa dòng
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
                            placeholder="Mã SKU"
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
                            placeholder="Giá"
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
                            placeholder="Tồn kho"
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
                              placeholder={`Chọn ${option.name}`}
                              options={(optionValuesByOptionId[option.id] ?? []).map((value) => ({
                                value: value.id,
                                label: `${value.value}`,
                              }))}
                              allowClear
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
                            Lưu biến thể
                          </Button>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Space>
            ) : (
              <Empty description="Vui lòng chọn sản phẩm để quản lý tùy chọn và biến thể" />
            )}
          </Card>

          <Card
            className="surface-card"
            title="Tồn kho hiện tại"
            extra={
              <Popconfirm
                title="Xóa các biến thể đã chọn?"
                description={`Đang chọn ${selectedInventoryIds.length} biến thể`}
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={() => void deleteSelectedInventory()}
                disabled={loading || selectedInventoryIds.length === 0}
              >
                <Button danger disabled={loading || selectedInventoryIds.length === 0}>
                  Xóa đã chọn ({selectedInventoryIds.length})
                </Button>
              </Popconfirm>
            }
          >
            <Table
              rowKey="id"
              dataSource={inventory}
              pagination={{ pageSize: 8 }}
              rowSelection={{
                selectedRowKeys: selectedInventoryIds,
                onChange: (selectedRowKeys) => setSelectedInventoryIds(selectedRowKeys as number[]),
              }}
              columns={[
                { title: "Sản phẩm", dataIndex: "product_name" },
                { title: "Mã SKU", dataIndex: "sku_code" },
                {
                  title: "Giá",
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
                  title: "Tồn kho",
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
                  title: "Thao tác",
                  key: "actions",
                  render: (_: unknown, record: InventoryRow) =>
                    editingInventoryId === record.id ? (
                      <Space>
                        <Button type="primary" size="small" loading={loading} onClick={() => void saveInventoryRow(record.id)}>
                          Lưu
                        </Button>
                        <Button size="small" onClick={cancelEditInventory} disabled={loading}>
                          Hủy
                        </Button>
                      </Space>
                    ) : (
                      <Space>
                        <Button size="small" onClick={() => startEditInventory(record)} disabled={loading}>
                          Sửa
                        </Button>
                        <Popconfirm
                          title="Xóa biến thể này?"
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() => void deleteInventoryRow(record.id)}
                          disabled={loading}
                        >
                          <Button size="small" danger disabled={loading}>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                },
              ]}
            />
          </Card>

          <Card
            className="surface-card"
            title="Đơn hàng của tôi"
            extra={
              <Popconfirm
                title="Xóa các đơn hàng đã chọn?"
                description={`Đang chọn ${selectedSellerOrderIds.length} đơn hàng`}
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={() => void deleteSelectedSellerOrders()}
                disabled={loading || selectedSellerOrderIds.length === 0}
              >
                <Button danger disabled={loading || selectedSellerOrderIds.length === 0}>
                  Xóa đã chọn ({selectedSellerOrderIds.length})
                </Button>
              </Popconfirm>
            }
          >
            <Table
              rowKey="id"
              dataSource={sellerOrders}
              pagination={{ pageSize: 8 }}
              rowSelection={{
                selectedRowKeys: selectedSellerOrderIds,
                onChange: (selectedRowKeys) => setSelectedSellerOrderIds(selectedRowKeys as number[]),
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <List
                    size="small"
                    dataSource={record.items}
                    locale={{ emptyText: "Đơn hàng này chưa có sản phẩm" }}
                    renderItem={(item) => (
                      <List.Item>
                        <span>{`${item.product_name || "Sản phẩm"} | Mã SKU: ${item.variant_sku_code || item.variant_id} | ${item.unit_price} x ${item.quantity}`}</span>
                      </List.Item>
                    )}
                  />
                ),
                rowExpandable: (record) => record.items.length > 0,
              }}
              columns={[
                { title: "ID", dataIndex: "id" },
                { title: "Khách hàng", dataIndex: "user_name", render: (value: string | undefined, record: OrderWithItems) => value || record.user_email || `Người dùng #${record.user_id}` },
                { title: "Tổng tiền", dataIndex: "total_price" },
                {
                  title: "Trạng thái",
                  dataIndex: "status_name",
                  render: (value: string | undefined) => <Tag color={orderStatusColor(value)}>{value || "không xác định"}</Tag>,
                },
                { title: "Số sản phẩm", dataIndex: "items_count", render: (value: number | undefined) => value ?? 0 },
                { title: "Tạo lúc", dataIndex: "created_at" },
                {
                  title: "Thao tác",
                  key: "actions",
                  render: (_: unknown, record: OrderWithItems) => (
                    <Popconfirm
                      title="Xóa đơn hàng này?"
                      description="Thao tác này không thể hoàn tác"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => void deleteSellerOrder(record.id)}
                      disabled={loading}
                    >
                      <Button size="small" danger disabled={loading}>
                        Xóa
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
      label: "Giao diện người mua",
      children: <ProductBrowser allowPurchase={false} />,
    },
  ];

  return (
    <RoleGate allowedRoles={[2]}>
      <EcommerceShell title="Quản lý nhà bán" description="Tạo sản phẩm, cấu hình tùy chọn/giá trị, thêm biến thể, quản lý tồn kho và đơn hàng của bạn.">
        <Tabs items={tabItems} />
      </EcommerceShell>
    </RoleGate>
  );
}
