"use client";

import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Button, Card, Col, Drawer, Empty, Form, InputNumber, List, Modal, Row, Select, Space, Tag, Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { API_BASE_URL, api } from "@/lib/api";
import { CartItem, Order, OrderItem, Product, ProductOption, ProductOptionValue, ProductVariant } from "@/types";
import { useSession } from "@/components/session-provider";

const { Paragraph, Text } = Typography;

interface ProductBrowserProps {
  allowPurchase?: boolean;
}

interface VariantAttributeDetail {
  id: number;
  variant_id: number;
  option_value_id: number | null;
  option_name?: string | null;
  option_value?: string | null;
  variant_sku_code?: string;
}

interface ProductVariantDetail extends ProductVariant {
  variant_attributes?: VariantAttributeDetail[];
}

interface ProductDetailApiData extends Product {
  product_variants?: ProductVariantDetail[];
}

interface OrderCreatePayload {
  user_id: number;
  seller_id: number;
  total_price: number;
  status_id: number;
  voucher_discount: number;
}

interface ProductPriceRange {
  minPrice: number;
  maxPrice: number;
  minDiscountedPrice: number;
  maxDiscountedPrice: number;
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
  return (variant.option_value_ids ?? []).filter((value): value is number => Number.isFinite(value));
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
  const variantOptionValueIds = new Set(getVariantOptionValueIds(variant).filter((v): v is number => v !== null));

  optionValues.forEach((value) => {
    if (variantOptionValueIds.has(value.id)) {
      selection[value.option_id] = value.id;
    }
  });

  return selection;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount));
}

function applyDiscount(price: number, discountPercent?: number): number {
  const safeDiscount = Math.max(0, Math.min(99, discountPercent ?? 0));
  return Math.round(price * (1 - safeDiscount / 100));
}

function buildPriceRange(variants: ProductVariant[], discountPercent?: number): ProductPriceRange | null {
  const prices = variants.map((variant) => variant.price).filter((price) => Number.isFinite(price));
  if (prices.length === 0) {
    return null;
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  return {
    minPrice,
    maxPrice,
    minDiscountedPrice: applyDiscount(minPrice, discountPercent),
    maxDiscountedPrice: applyDiscount(maxPrice, discountPercent),
  };
}

function formatPriceRange(minPrice: number, maxPrice: number): string {
  if (minPrice === maxPrice) {
    return `${formatCurrency(minPrice)} VND`;
  }

  return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)} VND`;
}

function resolveProductImageUrl(product: Product): string | undefined {
  const rawUrl = product.image_src ;
  if (!rawUrl) {
    return undefined;
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  if (rawUrl.startsWith("/")) {
    return `${API_BASE_URL}${rawUrl}`;
  }

  return `${API_BASE_URL}/${rawUrl}`;
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
  const [noOptionVariantIds, setNoOptionVariantIds] = useState<number[]>([]);
  const [priceRangesByProductId, setPriceRangesByProductId] = useState<Record<number, ProductPriceRange>>({});

  const optionValuesByOption = useMemo(() => groupValuesByOption(optionValues), [optionValues]);

  const selectedVariant = useMemo(() => {
    if (productVariants.length === 0) {
      return null;
    }

    // Nếu không có options, ưu tiên biến thể có variant_attributes.option_value_id = null
    if (productOptions.length === 0) {
      const noOptionVariantWithStock = productVariants.find((variant) => noOptionVariantIds.includes(variant.id) && variant.stock > 0);
      if (noOptionVariantWithStock) {
        return noOptionVariantWithStock;
      }

      const noOptionVariant = productVariants.find((variant) => noOptionVariantIds.includes(variant.id));
      if (noOptionVariant) {
        return noOptionVariant;
      }

      return productVariants.find((variant) => variant.stock > 0) ?? productVariants[0] ?? null;
    }

    // Có options: tìm biến thể khớp với lựa chọn
    const selectedIds = Object.values(selectedOptionValueIds).filter(Boolean);
    if (selectedIds.length === 0) {
      // Nếu chưa chọn options nhưng có biến thể "không lựa chọn" (option_value_id = null),
      // ưu tiên hiển thị biến thể này để vẫn có thể mua được.
      const noOptionVariantWithStock = productVariants.find((variant) => noOptionVariantIds.includes(variant.id) && variant.stock > 0);
      if (noOptionVariantWithStock) {
        return noOptionVariantWithStock;
      }

      const noOptionVariant = productVariants.find((variant) => noOptionVariantIds.includes(variant.id));
      if (noOptionVariant) {
        return noOptionVariant;
      }

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
  }, [noOptionVariantIds, optionValues, productOptions, productVariants, selectedOptionValueIds]);

  const totalCart = useMemo(
    () => cart.reduce((accumulator, item) => accumulator + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const hasAnyVariantOptionMapping = useMemo(
    () => productVariants.some((variant) => {
      const ids = getVariantOptionValueIds(variant);
      // Coi như có mapping nếu có null (no-option variant) hoặc có number IDs
      return ids.length > 0;
    }),
    [productVariants],
  );

  const hasAvailableCombination = (candidateSelections: Record<number, number>) => {
    const candidateIds = Object.values(candidateSelections).filter(Boolean);
    if (candidateIds.length === 0) {
      return false;
    }

    return productVariants.some((variant) => {
      const variantOptionValueIds = getVariantOptionValueIds(variant).filter((v): v is number => v !== null);
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
      .then(async ([productData, statuses]) => {
        // Lọc sản phẩm: chỉ hiển thị những sản phẩm có ít nhất 1 biến thể và tính khoảng giá min/max theo biến thể.
        const productsWithVariants = await Promise.all(
          productData.map(async (product) => {
            try {
              const variants = await api.get<ProductVariant[]>(`/api/product-variants/by-product/${product.id}`);
              return {
                product,
                variants,
              };
            } catch {
              return {
                product,
                variants: [],
              };
            }
          }),
        );

        const filteredProducts = productsWithVariants.filter((item) => item.variants.length > 0);
        const priceRanges = filteredProducts.reduce<Record<number, ProductPriceRange>>((accumulator, item) => {
          const range = buildPriceRange(item.variants, item.product.discount);
          if (range) {
            accumulator[item.product.id] = range;
          }
          return accumulator;
        }, {});

        setProducts(filteredProducts.map((item) => item.product));
        setPriceRangesByProductId(priceRanges);
        setOrderStatuses(statuses.length > 0 ? statuses : [{ id: ORDER_STATUS_IDS.PENDING, name: "đang chờ" }]);
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
      const [productDetail, options] = await Promise.all([
        api.get<ProductDetailApiData>(`/api/products/${product.id}`),
        api.get<ProductOption[]>(`/api/product-options/by-product/${product.id}`),
      ]);

      setSelectedProduct(productDetail);

      const detailVariants = productDetail.product_variants ?? [];
      const variants: ProductVariant[] = detailVariants.map((variant) => ({
        ...variant,
        option_value_ids: (variant.variant_attributes ?? [])
          .map((attribute) => attribute.option_value_id)
          .filter((value): value is number => Number.isFinite(value)),
      }));

      const noOptionIds = detailVariants
        .filter((variant) => (variant.variant_attributes ?? []).some((attribute) => attribute.option_value_id === null))
        .map((variant) => variant.id);

      setProductVariants(variants);
      setNoOptionVariantIds(noOptionIds);
      setProductOptions(options);

      const valuesByOption = await Promise.all(
        options.map((option) => api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${option.id}`)),
      );
      const flattenedValues = valuesByOption.flat();
      const groupedValues = groupValuesByOption(flattenedValues);
      setOptionValues(flattenedValues);

      // Nếu sản phẩm có options
      if (options.length > 0) {
        const preferredVariant =
          variants.find((variant) => {
            const ids = getVariantOptionValueIds(variant);
            return variant.stock > 0 && ids.length > 0;
          }) ??
          variants.find((variant) => {
            const ids = getVariantOptionValueIds(variant);
            return ids.length > 0;
          }) ??
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
      } else {
        // Sản phẩm không có options: khởi tạo selectedOptionValueIds rỗng
        setSelectedOptionValueIds({});
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
      message.warning("Hãy chọn biến thể sản phẩm");
      return;
    }

    if (selectedVariant.stock <= 0) {
      message.warning("Biến thể này đã hết hàng");
      return;
    }

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

    message.success("Đã thêm vào giỏ hàng");
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
      message.warning("Hãy đăng nhập");
      return;
    }

    if (cart.length === 0) {
      message.warning("Giỏ hàng đang trống");
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

      message.success("Đặt hàng thành công");
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
          Giỏ hàng ({cart.length})
        </Button>
      )}

      <Row gutter={[16, 16]}>
        {products.map((product) => (
          <Col xs={24} sm={12} lg={8} key={product.id}>
            {(() => {
              const imageUrl = resolveProductImageUrl(product);
              const range = priceRangesByProductId[product.id];
              const hasDiscount = (product.discount ?? 0) > 0;
              const originalPriceLabel = range ? formatPriceRange(range.minPrice, range.maxPrice) : "Đang cập nhật";
              const discountedPriceLabel = range ? formatPriceRange(range.minDiscountedPrice, range.maxDiscountedPrice) : "Đang cập nhật";

              return (
            <Card
              className="surface-card"
              title={product.name}
              extra={<Tag color="green">-{product.discount ?? 0}%</Tag>}
              cover={
                imageUrl ? (
                  <img src={imageUrl} alt={product.name} style={{ height: 220, width: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="flex h-[220px] items-center justify-center bg-slate-100 text-slate-500">Chưa có ảnh sản phẩm</div>
                )
              }
              actions={[
                <Button type="link" key="detail" onClick={() => void fetchProductDetail(product)}>
                  Xem chi tiết
                </Button>
              ]}
            >
              <Paragraph ellipsis={{ rows: 2 }}>{product.description || "Sản phẩm đang cập nhật mô tả"}</Paragraph>
              <Space direction="vertical" size={0} style={{ width: "100%" }}>
                {hasDiscount && (
                  <Text type="secondary" delete>
                    Giá gốc: {originalPriceLabel}
                  </Text>
                )}
                <Text strong style={{ color: "#c2410c" }}>
                  Giá bán: {hasDiscount ? discountedPriceLabel : originalPriceLabel}
                </Text>
              </Space>
              <Space>
                <Tag color="blue">{product.category_name || `Danh mục #${product.category_id}`}</Tag>
                <Tag color="gold">Shop: {product.seller_name || product.seller_id}</Tag>
              </Space>
            </Card>
              );
            })()}
          </Col>
        ))}
      </Row>

      {!loading && products.length === 0 && <Empty description="Chưa có sản phẩm" />}

      <Modal
        open={detailVisible}
        title={selectedProduct?.name || "Chi tiết"}
        onCancel={() => setDetailVisible(false)}
        footer={
          allowPurchase
            ? [
                <Button key="close" onClick={() => setDetailVisible(false)}>
                  Đóng
                </Button>,
                <Button key="cart" type="primary" onClick={() => addToCart(false)} disabled={!selectedVariant || selectedVariant.stock <= 0}>
                  Thêm vào giỏ
                </Button>,
                <Button key="buy" type="primary" onClick={() => addToCart(true)} disabled={!selectedVariant || selectedVariant.stock <= 0}>
                  Mua ngay
                </Button>,
              ]
            : [
                <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>
                  Đóng
                </Button>,
              ]
        }
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Paragraph>{selectedProduct?.description || "Không có mô tả"}</Paragraph>

          {productOptions.length > 0 && (
            <Card size="small" title="Lựa chọn sản phẩm">
              <Space direction="vertical" style={{ width: "100%" }}>
                {productOptions.map((option) => (
                  <Form.Item key={option.id} label={option.name} style={{ marginBottom: 8 }}>
                    <Select
                    allowClear
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
                      placeholder={`Chọn ${option.name}`}
                    />
                  </Form.Item>
                ))}
              </Space>
            </Card>
          )}

          <Card size="small" title="Chi tiết sản phẩm">
            {selectedVariant ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Text>Mã SKU: {selectedVariant.sku_code}</Text>
                <Text>Giá: {selectedVariant.price} VND</Text>
                <Text>
                  Tồn kho: <Tag color={selectedVariant.stock > 0 ? "green" : "red"}>{selectedVariant.stock}</Tag>
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
              <Text type="secondary">Không tìm thấy biến thể phù hợp</Text>
            )}
          </Card>

          {allowPurchase && (
            <Form layout="vertical">
              <Form.Item label="Số lượng">
                <InputNumber min={1} max={selectedVariant?.stock || 1} value={quantity} onChange={(value) => setQuantity(value || 1)} style={{ width: "100%" }} />
              </Form.Item>
            </Form>
          )}
        </Space>
      </Modal>

      {allowPurchase && (
        <Drawer
          title="Giỏ hàng"
          open={cartVisible}
          onClose={() => setCartVisible(false)}
          width={460}
          extra={
            <Button type="primary" onClick={placeOrder} disabled={cart.length === 0 || !currentUser} loading={loading}>
              Đặt hàng
            </Button>
          }
        >
          <List
            dataSource={cart}
            locale={{ emptyText: "Giỏ hàng trống" }}
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
                    Xóa
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
            <Text strong>Tổng tiền: {totalCart} VND</Text>
          </div>
        </Drawer>
      )}
    </Space>
  );
}
