"use client";

import { RoleGate } from "@/components/role-gate";
import { EcommerceShell } from "@/components/ecommerce-shell";
import { ProductBrowser } from "@/components/product-browser";

export default function MarketplacePage() {
  return (
    <RoleGate allowedRoles={[1, 2, 3]}>
      <EcommerceShell title="Trang mua sam" description="Khach mua, nguoi ban va admin deu co the xem giao dien nay; chi role mua moi dat hang duoc.">
        <ProductBrowser allowPurchase/>
      </EcommerceShell>
    </RoleGate>
  );
}