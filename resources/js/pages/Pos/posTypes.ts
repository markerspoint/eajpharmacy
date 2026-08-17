// Shared types for POS Index and layout components

export interface Variant {
    id: number;
    name: string;
    extra_price: number;
    price?: number | null;
    stock?: number;
    attributes: Record<string, string>;
    is_available: boolean;
    expiry_date?: string | null;
    is_expired?: boolean;
}

export interface BundleItem { name: string; qty: number; required: boolean; }
export interface RecipeItem  { name: string; quantity: number; unit: string; }

export interface Product {
    id: number;
    name: string;
    barcode: string | null;
    product_img: string | null;
    product_type: string;
    price: number;
    base_stock?: number;
    stock: number;
    category: { id: number; name: string } | null;
    variants: Variant[];
    has_variants: boolean;
    bundle_items: BundleItem[] | null;
    recipe_items: RecipeItem[] | null;
    expiry_date?: string | null;
    batch_number?: string | null;
    is_expired?: boolean;
    is_near_expiry?: boolean;
}

export interface QueuedOrder {
    id: number;
    ticket_number: string;
    qr_token: string;
    customer_name: string | null;
    status: string;
    payment_status?: string;
    subtotal: number;
    total: number;
    expires_at: string | null;
    created_at?: string | null;
    listed_by: string | null;
    items: {
        product_id: number;
        variant_id: number | null;
        product_name: string;
        variant_name: string | null;
        quantity: number;
        price: number;
        total: number;
    }[];
}

export interface Category { id: number; name: string; }

export interface CartItem {
    key: string;
    product_id: number;
    variant_id: number | null;
    name: string;
    variant_name: string | null;
    price: number;
    qty: number;
    stock: number;
    product_type: string;
    bundle_items: BundleItem[] | null;
    recipe_items: RecipeItem[] | null;
}

export interface TableOrder {
    id: number;
    table_id: number | null;
    table_number: number | null;
    section: string | null;
    label: string;
    status: string;
    total: number;
    customer_name: string | null;
}

export interface DiningTable {
    id: number;
    table_number: number;
    section: string | null;
    label: string;
    capacity: number;
    status: string;
}

export interface ActivePromo {
    id: number;
    name: string;
    code: string | null;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    applies_to: 'all' | 'specific_products' | 'specific_categories';
    minimum_purchase: number | null;
    product_ids: number[];
    category_ids: number[];
    expires_at: string | null;
}
