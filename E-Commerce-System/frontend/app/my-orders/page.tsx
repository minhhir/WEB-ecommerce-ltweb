"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App as AntApp, Button, Card, List, Space, Spin, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { Order, OrderItem, ProductVariant } from "@/types";
import { useSession } from "@/components/session-provider";

const { Text } = Typography;

const ORDER_STATUS_IDS = {
  PENDING: 1,
  CONFIRMED: 2,
  SHIPPING: 3,
  DELIVERED: 4,
  CANCELED: 5,
  PROCESSING: 6,
  COMPLETED: 7,
} as const;

const CANCELLABLE_STATUS_IDS = new Set<number>([
  ORDER_STATUS_IDS.PENDING,
  ORDER_STATUS_IDS.CONFIRMED,
  ORDER_STATUS_IDS.PROCESSING,
]);

const ORDER_STATUS_LABELS: Record<number, string> = {
  [ORDER_STATUS_IDS.PENDING]: "Dang cho",
  [ORDER_STATUS_IDS.CONFIRMED]: "Xac nhan don hang",
  [ORDER_STATUS_IDS.SHIPPING]: "Dang giao",
  [ORDER_STATUS_IDS.DELIVERED]: "Da giao",
  [ORDER_STATUS_IDS.CANCELED]: "Huy",
  [ORDER_STATUS_IDS.PROCESSING]: "Dang xu ly don hang",
  [ORDER_STATUS_IDS.COMPLETED]: "Da xong",
};

const ORDER_STATUS_COLORS: Record<number, string> = {
  [ORDER_STATUS_IDS.PENDING]: "gold",
  [ORDER_STATUS_IDS.CONFIRMED]: "blue",
  [ORDER_STATUS_IDS.SHIPPING]: "cyan",
  [ORDER_STATUS_IDS.DELIVERED]: "green",
  [ORDER_STATUS_IDS.CANCELED]: "red",
  [ORDER_STATUS_IDS.PROCESSING]: "processing",
  [ORDER_STATUS_IDS.COMPLETED]: "green",
};

interface OrderCreatePayload {
  user_id: number;
  seller_id: number;
  total_price: number;
  status_id: number;
  voucher_discount: number;
}

interface OrderWithItems extends Order {
  items: OrderItem[];
}

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

async function fetchOrdersByUser(userId: number): Promise<Order[]> {
  const candidatePaths = [
    `/api/orders/by-user/${userId}`,
    `/api/orders/by-buyer/${userId}`,
    `/api/orders/by-customer/${userId}`,
    `/api/orders/user/${userId}`,
    `/api/orders?user_id=${userId}`,
  ];

  for (const path of candidatePaths) {
    try {
      const orders = await api.get<Order[]>(path);
      return orders;
    } catch {
      // Try next endpoint shape.
    }
  }

  return [];
}

function getStatusLabel(order: Order) {
  if (order.status_name?.trim()) {
    return order.status_name;
  }

  return ORDER_STATUS_LABELS[order.status_id] ?? `Status #${order.status_id}`;
}

function getStatusColor(statusId: number) {
  return ORDER_STATUS_COLORS[statusId] ?? "default";
}

export default function MyOrdersPage() {
  const { message } = AntApp.useApp();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  const loadOrders = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    const rawOrders = await fetchOrdersByUser(currentUser.id);
    const ordersWithItems = await Promise.all(
      rawOrders.map(async (order) => ({
        ...order,
        items: await fetchOrderItems(order.id),
      })),
    );

    setOrders(ordersWithItems);
  }, [currentUser]);

  useEffect(() => {
    setLoading(true);
    void loadOrders()
      .catch((error: Error) => message.error(error.message))
      .finally(() => setLoading(false));
  }, [loadOrders, message]);

  useEffect(() => {
    setSelectedOrderIds((previous) => previous.filter((id) => orders.some((order) => order.id === id)));
  }, [orders]);

  const cancelOrders = async (ordersToCancel: OrderWithItems[]) => {
    if (ordersToCancel.length === 0) {
      message.warning("Vui lòng chọn đơn hàng cần hủy");
      return;
    }

    const invalidOrders = ordersToCancel.filter((order) => !CANCELLABLE_STATUS_IDS.has(order.status_id));
    if (invalidOrders.length > 0) {
      message.warning("Có đơn hàng không ở trạng thái cho phép hủy");
      return;
    }

    setLoading(true);
    try {
      for (const order of ordersToCancel) {
        await api.patch<Order, Pick<Order, "status_id">>(`/api/orders/${order.id}`, {
          status_id: ORDER_STATUS_IDS.CANCELED,
        });
        for (const item of order.items) {
          const productVariant = await api.get<ProductVariant>(`/api/product-variants/${item?.variant_id}`);
          const productStock = productVariant?.stock ?? 0;
          await api.patch<ProductVariant, Pick<ProductVariant, "stock">>(`/api/product-variants/${item.variant_id}`, {
            stock: productStock + item.quantity,
          });
        }
      }
      message.success(`Da huy ${ordersToCancel.length} don hang`);
      setSelectedOrderIds([]);
      await loadOrders();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const continueOrder = async (order: OrderWithItems) => {
    if (!currentUser) {
      return;
    }

    if (!order.seller_id) {
      message.warning("Don hang nay khong co seller_id de tiep tuc");
      return;
    }

    if (order.items.length === 0) {
      message.warning("Don hang khong co san pham de tiep tuc");
      return;
    }

    const totalPrice = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    setLoading(true);
    try {
      const newOrder = await api.post<Order, OrderCreatePayload>("/api/orders", {
        user_id: currentUser.id,
        seller_id: order.seller_id,
        total_price: totalPrice,
        status_id: ORDER_STATUS_IDS.PENDING,
        voucher_discount: 0,
      });

      await Promise.all(
        order.items.map((item) =>
          api.post<OrderItem, Omit<OrderItem, "id">>("/api/order-items", {
            order_id: newOrder.id,
            variant_id: item.variant_id,
            unit_price: item.unit_price,
            quantity: item.quantity,
          }),
        ),
      );

      message.success("Da tiep tuc dat hang");
      await loadOrders();
    } catch (error) {
      const err = error as Error;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalOrders = orders.length;
  const openOrders = useMemo(() => orders.filter((order) => CANCELLABLE_STATUS_IDS.has(order.status_id)).length, [orders]);

  return (
    <EcommerceShell title="Don hang cua toi" description="Xem lich su don hang, tiep tuc dat lai don cu va huy don khi status_id la 1, 2 hoac 6.">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card className="surface-card">
            <Space size={24} wrap>
              <Text strong>Tong don: {totalOrders}</Text>
              <Text strong>Don co the huy: {openOrders}</Text>
              <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()} loading={loading}>
                Tai lai
              </Button>
              <Button
                danger
                disabled={loading || selectedOrderIds.length === 0}
                onClick={() => {
                  const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order.id));
                  void cancelOrders(selectedOrders);
                }}
              >
                Huy da chon ({selectedOrderIds.length})
              </Button>
            </Space>
          </Card>

          <Card className="surface-card" title="Danh sach don hang">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center">
                <Spin />
              </div>
            ) : (
              <Table<OrderWithItems>
                rowKey="id"
                dataSource={orders}
                pagination={{ pageSize: 8 }}
                rowSelection={{
                  selectedRowKeys: selectedOrderIds,
                  onChange: (selectedRowKeys) => setSelectedOrderIds(selectedRowKeys as number[]),
                  getCheckboxProps: (record) => ({
                    disabled: !CANCELLABLE_STATUS_IDS.has(record.status_id) || loading,
                  }),
                }}
                expandable={{
                  expandedRowRender: (record) => (
                    <List
                      size="small"
                      dataSource={record.items}
                      locale={{ emptyText: "Don hang khong co item" }}
                      renderItem={(item) => (
                        <List.Item>
                          <Text>{`${item.product_name || "San pham"} | SKU: ${item.variant_sku_code || item.variant_id} | ${item.unit_price} x ${item.quantity}`}</Text>
                        </List.Item>
                      )}
                    />
                  ),
                }}
                columns={[
                  { title: "Ma don", dataIndex: "id" },
                  {
                    title: "Trang thai",
                    dataIndex: "status_id",
                    render: (_value: number, record: OrderWithItems) => <Tag color={getStatusColor(record.status_id)}>{getStatusLabel(record)}</Tag>,
                  },
                  { title: "Tong tien", dataIndex: "total_price" },
                  { title: "Tao luc", dataIndex: "created_at" },
                  {
                    title: "Thao tac",
                    key: "actions",
                    render: (_value: unknown, record: OrderWithItems) => (
                      <Space>
                        <Button size="small" onClick={() => void continueOrder(record)} loading={loading}>
                          Tiep tuc order
                        </Button>
                        <Button
                          danger
                          size="small"
                          disabled={!CANCELLABLE_STATUS_IDS.has(record.status_id) || loading}
                          onClick={() => void cancelOrders([record])}
                        >
                          Huy order
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Space>
      </EcommerceShell>
  );
}
