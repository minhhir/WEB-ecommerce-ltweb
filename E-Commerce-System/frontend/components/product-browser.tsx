"use client";

import { useState, useEffect } from "react";
import { Card, Button, Modal, Input, Rate, List, Avatar, message, Row, Col, Spin, Empty, Typography } from "antd";
import { ShoppingCartOutlined, MessageOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Search, TextArea } = Input;
const { Title, Text } = Typography;

// Định nghĩa các interface cơ bản
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  seller_id: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  user_name: string;
  created_at: string;
}

interface ProductBrowserProps {
  allowPurchase?: boolean;
}

export function ProductBrowser({ allowPurchase }: ProductBrowserProps) {
  // State quản lý danh sách sản phẩm & tìm kiếm
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // State quản lý Modal chi tiết & Đánh giá
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // State cho Form viết Đánh giá mới
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch danh sách sản phẩm (Hỗ trợ Search)
  const fetchProducts = async (keyword = "") => {
    setLoading(true);
    try {
      // Gọi API lấy sản phẩm, gắn thêm params ?q=
      const res: any = await api.get(`/api/products?q=${keyword}&per_page=50`);
      // api.ts đã cấu hình trả về data trực tiếp, ta kiểm tra linh hoạt để tránh lỗi
      setProducts(Array.isArray(res) ? res : res?.data || []);
    } catch (error: any) {
      message.error(error.message || "Lỗi tải danh sách sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  // Tự động load sản phẩm khi vào trang
  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. Fetch danh sách review của 1 sản phẩm cụ thể
  const fetchReviews = async (productId: number) => {
    setReviewLoading(true);
    try {
      const res: any = await api.get(`/api/products/${productId}/reviews`);
      setReviews(Array.isArray(res) ? res : res?.data || []);
    } catch (error) {
      message.error("Không thể tải đánh giá sản phẩm");
    } finally {
      setReviewLoading(false);
    }
  };

  // Mở Modal xem chi tiết
  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsModalVisible(true);
    fetchReviews(product.id); // Load comment ngay khi mở
  };

  // Đóng Modal và clear dữ liệu rác
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedProduct(null);
    setReviews([]);
    setComment("");
    setRating(5);
  };

  // 3. Hàm gửi Review mới lên Backend
  const submitReview = async () => {
    if (!selectedProduct) return;
    if (!comment.trim()) {
      return message.warning("Vui lòng nhập nội dung bình luận!");
    }

    setSubmitting(true);
    try {
      await api.post(`/api/products/${selectedProduct.id}/reviews`, {
        rating: rating,
        comment: comment,
      });
      message.success("Cảm ơn bạn đã đánh giá!");
      setComment(""); // Reset form
      setRating(5);
      fetchReviews(selectedProduct.id); // Gọi lại API để hiển thị comment vừa đăng
    } catch (error: any) {
      message.error(error.message || "Bạn cần đăng nhập để đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý thêm vào giỏ hàng (Tạm thời là Mock)
  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation(); // Ngăn sự kiện click làm mở Modal
    message.success(`Đã thêm ${product.name} vào giỏ hàng!`);
  };

  return (
    <div>
      {/* --- Thanh tìm kiếm --- */}
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <Title level={4} style={{ margin: 0 }}>Danh sách Sản phẩm</Title>
        <Search
          placeholder="Nhập tên sản phẩm cần tìm..."
          allowClear
          enterButton="Tìm kiếm"
          size="large"
          onSearch={(value) => fetchProducts(value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* --- Lưới Sản phẩm --- */}
      {loading ? (
        <div className="flex justify-center p-10"><Spin size="large" /></div>
      ) : products.length === 0 ? (
        <div className="bg-white p-10 rounded-lg shadow-sm">
          <Empty description="Không tìm thấy sản phẩm nào phù hợp" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {products.map((product) => (
            <Col xs={24} sm={12} md={8} lg={6} key={product.id}>
              <Card
                hoverable
                onClick={() => handleOpenProduct(product)}
                cover={
                  <img
                    alt={product.name}
                    src={product.image_url || "https://placehold.co/400x300?text=No+Image"}
                    style={{ height: 200, objectFit: "cover" }}
                  />
                }
                actions={
                  allowPurchase
                    ? [
                        <Button
                          type="primary"
                          icon={<ShoppingCartOutlined />}
                          onClick={(e) => handleAddToCart(e, product)}
                        >
                          Mua ngay
                        </Button>,
                      ]
                    : []
                }
              >
                <Card.Meta
                  title={<span className="text-lg truncate">{product.name}</span>}
                  description={
                    <div>
                      <p className="text-red-500 font-bold text-lg mt-1 mb-2">
                        {product.price.toLocaleString("vi-VN")} đ
                      </p>
                      <p className="text-gray-500 text-sm m-0 line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* --- Modal Chi tiết sản phẩm & Đánh giá --- */}
      <Modal
        title={<Title level={3} className="m-0 border-b pb-4">{selectedProduct?.name}</Title>}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={850}
        centered
      >
        {selectedProduct && (
          <div className="flex flex-col md:flex-row gap-6 mt-4">

            {/* Cột trái: Ảnh & Thông tin sản phẩm */}
            <div className="w-full md:w-1/2">
              <img
                src={selectedProduct.image_url || "https://placehold.co/400x300?text=No+Image"}
                alt={selectedProduct.name}
                className="w-full rounded-lg object-cover mb-4 shadow-sm border"
              />
              <div className="bg-gray-50 p-4 rounded-lg">
                <Text className="text-3xl text-red-600 font-bold block mb-2">
                  {selectedProduct.price.toLocaleString("vi-VN")} đ
                </Text>
                <Text className="block text-gray-500 mb-4">
                  Kho còn: <strong className="text-black">{selectedProduct.stock_quantity}</strong> sản phẩm
                </Text>
                <Text className="block whitespace-pre-wrap text-justify">
                  {selectedProduct.description}
                </Text>
              </div>

              {allowPurchase && (
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  className="mt-4 w-full h-12 text-lg font-semibold"
                  onClick={(e) => handleAddToCart(e, selectedProduct)}
                >
                  Thêm vào giỏ hàng
                </Button>
              )}
            </div>

            {/* Cột phải: Khu vực Đánh giá (Review) */}
            <div className="w-full md:w-1/2 flex flex-col h-full">
              <Title level={5} className="mb-4"><MessageOutlined /> Đánh giá từ khách hàng</Title>

              {/* Form Viết Đánh Giá */}
              {allowPurchase && (
                <div className="bg-brand-50 border border-brand-200 p-4 rounded-lg mb-4">
                  <Text strong className="block mb-2 text-brand-800">Gửi đánh giá của bạn</Text>
                  <Rate value={rating} onChange={setRating} className="mb-3 text-brand-500" />
                  <TextArea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Sản phẩm này thế nào? Hãy chia sẻ cùng mọi người nhé..."
                    className="mb-3 border-gray-300"
                  />
                  <Button
                    type="primary"
                    onClick={submitReview}
                    loading={submitting}
                    className="w-full bg-brand-600 hover:bg-brand-700"
                  >
                    Gửi bình luận
                  </Button>
                </div>
              )}

              {/* Danh sách các review đã có */}
              <div className="flex-1 bg-white border border-gray-100 rounded-lg p-2 shadow-inner">
                {reviewLoading ? (
                  <div className="flex justify-center p-10"><Spin /></div>
                ) : (
                  <List
                    className="max-h-80 overflow-y-auto pr-2 custom-scrollbar"
                    itemLayout="horizontal"
                    dataSource={reviews}
                    locale={{ emptyText: "Chưa có đánh giá nào. Hãy là người đầu tiên!" }}
                    renderItem={(item) => (
                      <List.Item className="border-b border-gray-100 last:border-0 py-3">
                        <List.Item.Meta
                          avatar={
                            <Avatar className="bg-brand-500 text-white font-bold">
                              {item.user_name ? item.user_name.charAt(0).toUpperCase() : "U"}
                            </Avatar>
                          }
                          title={
                            <div className="flex justify-between items-center">
                              <Text strong className="text-gray-800">{item.user_name}</Text>
                              <Rate disabled defaultValue={item.rating} className="text-xs" />
                            </div>
                          }
                          description={<Text className="text-gray-600 mt-1 block">{item.comment}</Text>}
                        />
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}