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
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartVisible, setCartVisible] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const totalCart = useMemo(
    () => cart.reduce((accumulator, item) => accumulator + item.unitPrice * item.quantity, 0),
    [cart],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Product[]>("/api/products"),
      allowPurchase ? api.get<Array<{ id: number; name: string }>>("/api/admin/order-statuses") : Promise.resolve([]),
    ])
      .then(([productData, statuses]) => {
        setProducts(productData);
        setOrderStatuses(statuses.length > 0 ? statuses : [{ id: 1, name: "pending" }]);
      })
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [allowPurchase, message]);

  const fetchProductDetail = async (product: Product) => {
    setSelectedProduct(product);
    setDetailVisible(true);
    setVariantId(null);
    setQuantity(1);

    const [variants, options] = await Promise.all([
      api.get<ProductVariant[]>(`/api/product-variants/by-product/${product.id}`),
      api.get<ProductOption[]>(`/api/product-options/by-product/${product.id}`),
    ]);

    setProductVariants(variants);
    setProductOptions(options);

    const valuesByOption = await Promise.all(
      options.map((option) => api.get<ProductOptionValue[]>(`/api/product-option-values/by-option/${option.id}`)),
    );
    setOptionValues(valuesByOption.flat());

    if (variants.length > 0) {
      setVariantId(variants[0].id);
    }
  };

  const addToCart = (buyNow = false) => {
    if (!allowPurchase) {
      return;
    }

    if (!selectedProduct || !variantId) {
      message.warning("Hay chon bien the san pham");
      return;
    }

    const variant = productVariants.find((item) => item.id === variantId);
    if (!variant) {
      message.warning("Khong tim thay bien the");
      return;
    }

    setCart((previous) => {
      const existing = previous.find((item) => item.variantId === variant.id);
      if (existing) {
        return previous.map((item) =>
          item.variantId === variant.id
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
          variantId: variant.id,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          skuCode: variant.sku_code,
          unitPrice: variant.price,
          quantity,
        },
      ];
    });

    message.success("Da them vao gio hang");
    if (buyNow) {
      setCartVisible(true);
    }
  };

  const removeCartItem = (variantIdToRemove: number) => {
    setCart((previous) => previous.filter((item) => item.variantId !== variantIdToRemove));
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

    const pendingStatus = orderStatuses.find((item) => item.name.toLowerCase().includes("pending"));
    const statusId = pendingStatus?.id ?? orderStatuses[0]?.id ?? 1;

    setLoading(true);
    try {
      const order = await api.post<Order, Pick<Order, "user_id" | "total_price" | "status_id" | "voucher_discount">>(
        "/api/orders",
        {
          user_id: currentUser.id,
          total_price: totalCart,
          status_id: statusId,
          voucher_discount: 0,
        },
      );

      await Promise.all(
        cart.map((item) =>
          api.post<OrderItem, Omit<OrderItem, "id">>("/api/order-items", {
            order_id: order.id,
            variant_id: item.variantId,
            unit_price: item.unitPrice,
            quantity: item.quantity,
          }),
        ),
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
                <Button type="link" key="detail" onClick={() => fetchProductDetail(product)}>
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
                <Button key="cart" type="primary" onClick={() => addToCart(false)}>
                  Them vao gio
                </Button>,
                <Button key="buy" type="primary" onClick={() => addToCart(true)}>
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
              <Space wrap>
                {productOptions.map((option) => (
                  <Tag key={option.id} color="cyan">
                    {option.name}: {optionValues.filter((value) => value.option_id === option.id).map((value) => value.value).join(", ")}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {allowPurchase ? (
            <Form layout="vertical">
              <Form.Item label="Bien the">
                <Select
                  value={variantId ?? undefined}
                  onChange={(value) => setVariantId(value)}
                  options={productVariants.map((variant) => ({
                    value: variant.id,
                    label: `${variant.sku_code} | ${variant.price} VND | stock ${variant.stock}`,
                  }))}
                  placeholder="Chon bien the"
                />
              </Form.Item>
              <Form.Item label="So luong">
                <InputNumber min={1} value={quantity} onChange={(value) => setQuantity(value || 1)} style={{ width: "100%" }} />
              </Form.Item>
            </Form>
          ) : (
            <Card size="small" title="Bien the">
              <Space direction="vertical" style={{ width: "100%" }}>
                {productVariants.map((variant) => (
                  <Text key={variant.id}>{`${variant.sku_code} | ${variant.price} VND | stock ${variant.stock}`}</Text>
                ))}
              </Space>
            </Card>
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
                          line.variantId === item.variantId
                            ? {
                                ...line,
                                quantity: value || 1,
                              }
                            : line,
                        ),
                      );
                    }}
                  />,
                  <Button danger key="remove" onClick={() => removeCartItem(item.variantId)}>
                    Xoa
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={`${item.productName} (${item.skuCode})`}
                  description={`${item.unitPrice} VND x ${item.quantity}`}
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