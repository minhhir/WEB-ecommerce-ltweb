"use client";

import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Button, Card, Col, Drawer, Empty, Form, InputNumber, List, Modal, Row, Select, Space, Tag, Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { CartItem, Order, OrderItem, Product, ProductOption, ProductOptionValue, ProductVariant } from "@/types";
import { useSession } from "@/components/session-provider";

const { Paragraph, Text } = Typography;

interface ProductBrowserProps {
  allowPurchase?: boolean;
}

interface VariantAttribute {
  variant_id: number;
  option_value_id: number;
}

interface OrderCreatePayload {
  user_id: number;
  seller_id: number;
  total_price: number;
  status_id: number;
  voucher_discount: number;
}

const ORDER_STATUS_IDS = {
  PENDING: 1,
  CONFIRMED: 2,
  SHIPPING: 3,
  DELIVERED: 4,
  CANCELED: 5,
  PROCESSING: 6,
  COMPLETED: 7,
} as const;

function getVariantOptionValueIds(variant: ProductVariant): number[] {
  return (variant.option_value_ids ?? []).filter((value) => Number.isFinite(value));
}

function groupValuesByOption(optionValues: ProductOptionValue[]): Record<number, ProductOptionValue[]> {
  return optionValues.reduce<Record<number, ProductOptionValue[]>>((accumulator, value) => {
    const currentValues = accumulator[value.option_id] ?? [];
    accumulator[value.option_id] = [...currentValues, value];
    return accumulator;
  }, {});
}

function buildSelectionFromVariant(variant: ProductVariant, optionValues: ProductOptionValue[]): Record<number, number> {
  const selection: Record<number, number> = {};
  const variantOptionValueIds = new Set(getVariantOptionValueIds(variant));

  optionValues.forEach((value) => {
    if (variantOptionValueIds.has(value.id)) {
      selection[value.option_id] = value.id;
    }
  });

  return selection;
}

export function ProductBrowser({ allowPurchase = true }: Readonly<ProductBrowserProps>) {
  const { message } = AntApp.useApp();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionValues, setOptionValues] = useState<ProductOptionValue[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOptionValueIds, setSelectedOptionValueIds] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [cartVisible, setCartVisible] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const optionValuesByOption = useMemo(() => groupValuesByOption(optionValues), [optionValues]);

  const selectedVariant = useMemo(() => {
    const selectedIds = Object.values(selectedOptionValueIds).filter(Boolean);
    if (selectedIds.length === 0 || productVariants.length === 0) {
      return null;
    }

    const directMatch = productVariants.find((variant) => {
      const rawIds = getVariantOptionValueIds(variant);
      if (rawIds.length === 0 || rawIds.length !== selectedIds.length) {
        return false;
      }

      return selectedIds.every((id) => rawIds.includes(id));
    });

    if (directMatch) {
      return directMatch;
    }

    const selectedValueTexts = optionValues
      .filter((value) => selectedIds.includes(value.id))
      .map((value) => value.value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    if (selectedValueTexts.length === 0) {
      return null;
    }

    return (
      productVariants.find((variant) => {
        const sku = variant.sku_code.toLowerCase();
        return selectedValueTexts.every((valueText) => sku.includes(valueText));
      }) ?? null
    );
  }, [optionValues, productVariants, selectedOptionValueIds]);

  const totalCart = useMemo(
    () => cart.reduce((accumulator, item) => accumulator + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const hasAnyVariantOptionMapping = useMemo(
    () => productVariants.some((variant) => getVariantOptionValueIds(variant).length > 0),
    [productVariants],
  );

  const fetchVariantOptionValueIds = async (variantId: number): Promise<number[]> => {
    const candidatePaths = [
      `/api/variant-attributes/by-variant/${variantId}`,
      `/api/variant-attributes/by-variant-id/${variantId}`,
      `/api/variant-attributes?variant_id=${variantId}`,
    ];

    for (const path of candidatePaths) {
      try {
        const attributes = await api.get<VariantAttribute[]>(path);
        const optionValueIds = attributes
          .map((attribute) => attribute.option_value_id)
          .filter((value) => Number.isFinite(value));
        if (optionValueIds.length > 0) {
          return optionValueIds;
        }
      } catch {
        // Try next candidate path silently.
      }
    }

    return [];
  };

  const hasAvailableCombination = (candidateSelections: Record<number, number>) => {
    const candidateIds = Object.values(candidateSelections).filter(Boolean);
    if (candidateIds.length === 0) {
      return false;
    }

    return productVariants.some((variant) => {
      const variantOptionValueIds = getVariantOptionValueIds(variant);
      return variant.stock > 0 && candidateIds.every((id) => variantOptionValueIds.includes(id));
    });
  };

  const isOptionValueDisabled = (optionId: number, valueId: number) => {
    if (!hasAnyVariantOptionMapping) {
      return false;
    }

    const candidateSelections = {
      ...selectedOptionValueIds,
      [optionId]: valueId,
    };

    return !hasAvailableCombination(candidateSelections);
  };
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Product[]>("/api/products"),
      allowPurchase ? api.get<Array<{ id: number; name: string }>>("/api/admin/order-statuses") : Promise.resolve([]),
    ])
      .then(([productData, statuses]) => {
        setProducts(productData);
        setOrderStatuses(statuses.length > 0 ? statuses : [{ id: ORDER_STATUS_IDS.PENDING, name: "dang cho" }]);
      })
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [allowPurchase, message]);

  const fetchProductDetail = async (product: Product) => {
    setLoading(true);
    setSelectedProduct(product);
    setDetailVisible(true);
    setSelectedOptionValueIds({});
    setQuantity(1);

    try {
      const [variantData, options] = await Promise.all([
        api.get<ProductVariant[]>(`/api/product-variants/by-product/${product.id}`),
        api.get<ProductOption[]>(`/api/product-options/by-product/${product.id}`),
      ]);

      const variants = await Promise.all(
        variantData.map(async (variant) => {
          const existingOptionValueIds = getVariantOptionValueIds(variant);
          if (existingOptionValueIds.length > 0) {
            return variant;
          }

          const hydratedOptionValueIds = await fetchVariantOptionValueIds(variant.id);
          return {
            ...variant,
            option_value_ids: hydratedOptionValueIds,
          };
        }),
      );

      setProductVariants(variants);
      setProductOptions(options);

      const valuesByOption = await Promise.all(
        options.map((option) => api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${option.id}`)),
      );
      const flattenedValues = valuesByOption.flat();
      const groupedValues = groupValuesByOption(flattenedValues);
      setOptionValues(flattenedValues);

      const preferredVariant =
        variants.find((variant) => variant.stock > 0 && getVariantOptionValueIds(variant).length > 0) ??
        variants.find((variant) => getVariantOptionValueIds(variant).length > 0) ??
        variants[0] ??
        null;

      if (preferredVariant) {
        setSelectedOptionValueIds(buildSelectionFromVariant(preferredVariant, flattenedValues));
      } else {
        const defaultSelections: Record<number, number> = {};
        options.forEach((option) => {
          const firstValue = groupedValues[option.id]?.[0];
          if (firstValue) {
            defaultSelections[option.id] = firstValue.id;
          }
        });
        setSelectedOptionValueIds(defaultSelections);
      }
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (buyNow = false) => {
    if (!allowPurchase) {
      return;
    }

    if (!selectedProduct || !selectedVariant) {
      message.warning("Hay chon bien the san pham");
      return;
    }

    if (selectedVariant.stock <= 0) {
      message.warning("Bien the nay da het hang");
      return;
    }

    const missingOption = productOptions.find(
      (option) => optionValues.some((value) => value.option_id === option.id) && !selectedOptionValueIds[option.id],
    );

    const selectedValues = optionValues.filter((value) => selectedOptionValueIds[value.option_id] === value.id);
    const optionSummary = selectedValues.length > 0 ? selectedValues.map((value) => value.value).join(" / ") : undefined;
    const lineKey = `${selectedVariant.id}-${selectedValues.map((value) => value.id).sort((a, b) => a - b).join("-") || "base"}`;

    setCart((previous) => {
      const existing = previous.find((item) => item.lineKey === lineKey);
      if (existing) {
        return previous.map((item) =>
          item.lineKey === lineKey
            ? {
                ...item,
                quantity: item.quantity + quantity,
              }
            : item,
        );
      }

      return [
        ...previous,
        {
          lineKey,
          variantId: selectedVariant.id,
          productId: selectedProduct.id,
          sellerId: selectedProduct.seller_id,
          productName: selectedProduct.name,
          skuCode: selectedVariant.sku_code,
          unitPrice: selectedVariant.price,
          quantity,
          optionSummary,
        },
      ];
    });

    message.success("Da them vao gio hang");
    if (buyNow) {
      setCartVisible(true);
    }
  };

  const removeCartItem = (lineKeyToRemove: string) => {
    setCart((previous) => previous.filter((item) => item.lineKey !== lineKeyToRemove));
  };

  const placeOrder = async () => {
    if (!allowPurchase) {
      return;
    }

    if (!currentUser) {
      message.warning("Hay dang nhap");
      return;
    }

    if (cart.length === 0) {
      message.warning("Gio hang dang trong");
      return;
    }

    const statusId = orderStatuses.some((item) => item.id === ORDER_STATUS_IDS.PENDING)
      ? ORDER_STATUS_IDS.PENDING
      : orderStatuses[0]?.id ?? ORDER_STATUS_IDS.PENDING;
    const cartBySeller = cart.reduce<Record<number, CartItem[]>>((accumulator, item) => {
      const currentItems = accumulator[item.sellerId] ?? [];
      accumulator[item.sellerId] = [...currentItems, item];
      return accumulator;
    }, {});

    setLoading(true);
    try {
      await Promise.all(
        Object.entries(cartBySeller).map(async ([sellerIdText, sellerItems]) => {
          const sellerId = Number(sellerIdText);
          const sellerTotal = sellerItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

          const order = await api.post<Order, OrderCreatePayload>("/api/orders", {
            user_id: currentUser.id,
            seller_id: sellerId,
            total_price: sellerTotal,
            status_id: statusId,
            voucher_discount: 0,
          });

          await Promise.all(
            sellerItems.map((item) =>
              api.post<OrderItem, Omit<OrderItem, "id">>("/api/order-items", {
                order_id: order.id,
                variant_id: item.variantId,
                unit_price: item.unitPrice,
                quantity: item.quantity,
              }),
            ),
          );
        }),
      );

      message.success("Dat hang thanh cong");
      setCart([]);
      setCartVisible(false);
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedValueTextByOptionId = useMemo(() => {
    return productOptions.reduce<Record<number, string>>((accumulator, option) => {
      const selectedValue = optionValues.find((value) => value.option_id === option.id && selectedOptionValueIds[option.id] === value.id);
      if (selectedValue) {
        accumulator[option.id] = selectedValue.value;
      }
      return accumulator;
    }, {});
  }, [optionValues, productOptions, selectedOptionValueIds]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {allowPurchase && (
        <Button icon={<ShoppingCartOutlined />} onClick={() => setCartVisible(true)} disabled={cart.length === 0}>
          Gio hang ({cart.length})
        </Button>
      )}

      <Row gutter={[16, 16]}>
        {products.map((product) => (
          <Col xs={24} sm={12} lg={8} key={product.id}>
            <Card
              className="surface-card"
              title={product.name}
              extra={<Tag color="green">-{product.discount ?? 0}%</Tag>}
              actions={[
                <Button type="link" key="detail" onClick={() => void fetchProductDetail(product)}>
                  Xem chi tiet
                </Button>,
                allowPurchase ? (
                  <Button
                    type="link"
                    key="buy"
                    onClick={async () => {
                      await fetchProductDetail(product);
                      setCartVisible(true);
                    }}
                  >
                    Mua
                  </Button>
                ) : (
                  <span key="view-only">Xem</span>
                ),
              ]}
            >
              <Paragraph ellipsis={{ rows: 2 }}>{product.description || "San pham dang cap nhat mo ta"}</Paragraph>
              <Space>
                <Tag color="blue">{product.category_name || `Category #${product.category_id}`}</Tag>
                <Tag color="gold">Shop: {product.seller_name || product.seller_id}</Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {!loading && products.length === 0 && <Empty description="Chua co san pham" />}

      <Modal
        open={detailVisible}
        title={selectedProduct?.name || "Chi tiet"}
        onCancel={() => setDetailVisible(false)}
        footer={
          allowPurchase
            ? [
                <Button key="close" onClick={() => setDetailVisible(false)}>
                  Dong
                </Button>,
                <Button key="cart" type="primary" onClick={() => addToCart(false)} disabled={!selectedVariant || selectedVariant.stock <= 0}>
                  Them vao gio
                </Button>,
                <Button key="buy" type="primary" onClick={() => addToCart(true)} disabled={!selectedVariant || selectedVariant.stock <= 0}>
                  Mua ngay
                </Button>,
              ]
            : [
                <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>
                  Dong
                </Button>,
              ]
        }
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Paragraph>{selectedProduct?.description || "Khong co mo ta"}</Paragraph>

          {productOptions.length > 0 && (
            <Card size="small" title="Lua chon san pham">
              <Space direction="vertical" style={{ width: "100%" }}>
                {productOptions.map((option) => (
                  <Form.Item key={option.id} label={option.name} style={{ marginBottom: 8 }}>
                    <Select
                      value={selectedOptionValueIds[option.id]}
                      onChange={(value) =>
                        setSelectedOptionValueIds((previous) => ({
                          ...previous,
                          [option.id]: value,
                        }))
                      }
                      options={(optionValuesByOption[option.id] ?? []).map((value) => ({
                        value: value.id,
                        label: `${value.value}`,
                        disabled: isOptionValueDisabled(option.id, value.id),
                      }))}
                      placeholder={`Chon ${option.name}`}
                    />
                  </Form.Item>
                ))}
              </Space>
            </Card>
          )}

          <Card size="small" title="Bien the duoc chon">
            {selectedVariant ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Text>SKU: {selectedVariant.sku_code}</Text>
                <Text>Gia: {selectedVariant.price} VND</Text>
                <Text>
                  Ton kho: <Tag color={selectedVariant.stock > 0 ? "green" : "red"}>{selectedVariant.stock}</Tag>
                </Text>
                {Object.keys(selectedValueTextByOptionId).length > 0 && (
                  <Space wrap>
                    {productOptions.map((option) => {
                      const valueText = selectedValueTextByOptionId[option.id];
                      return valueText ? <Tag key={option.id}>{`${option.name}: ${valueText}`}</Tag> : null;
                    })}
                  </Space>
                )}
              </Space>
            ) : (
              <Text type="secondary">Khong tim thay bien the phu hop voi lua chon hien tai</Text>
            )}
          </Card>

          {allowPurchase && (
            <Form layout="vertical">
              <Form.Item label="So luong">
                <InputNumber min={1} max={selectedVariant?.stock || 1} value={quantity} onChange={(value) => setQuantity(value || 1)} style={{ width: "100%" }} />
              </Form.Item>
            </Form>
          )}
        </Space>
      </Modal>

      {allowPurchase && (
        <Drawer
          title="Gio hang"
          open={cartVisible}
          onClose={() => setCartVisible(false)}
          width={460}
          extra={
            <Button type="primary" onClick={placeOrder} disabled={cart.length === 0 || !currentUser} loading={loading}>
              Dat hang
            </Button>
          }
        >
          <List
            dataSource={cart}
            locale={{ emptyText: "Gio hang trong" }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <InputNumber
                    key="qty"
                    min={1}
                    value={item.quantity}
                    onChange={(value) => {
                      setCart((previous) =>
                        previous.map((line) =>
                          line.lineKey === item.lineKey
                            ? {
                                ...line,
                                quantity: value || 1,
                              }
                            : line,
                        ),
                      );
                    }}
                  />,
                  <Button danger key="remove" onClick={() => removeCartItem(item.lineKey)}>
                    Xoa
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={`${item.productName} (${item.skuCode})`}
                  description={`${item.optionSummary ? `${item.optionSummary} | ` : ""}${item.unitPrice} VND x ${item.quantity}`}
                />
              </List.Item>
            )}
          />
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3">
            <Text strong>Tong tien: {totalCart} VND</Text>
          </div>
        </Drawer>
      )}
    </Space>
  );
}
