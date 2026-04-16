"use client";

import { RoleGate } from "@/components/role-gate";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { ProductBrowser } from "@/components/product-browser";

export default function MarketplacePage() {
  return (
    <RoleGate allowedRoles={[1, 2, 3]}>
      <EcommerceShell title="Trang mua sắm" description="Tích cực mua hàng vận may sẽ tới">
        <ProductBrowser allowPurchase/>
      </EcommerceShell>
    </RoleGate>
  );
}