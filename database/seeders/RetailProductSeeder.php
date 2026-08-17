<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\ProductVariant;
use App\Models\ProductVariantStock;
use Illuminate\Database\Seeder;

class RetailProductSeeder extends Seeder
{
    /**
     * Standard retail products for ABC Main Store (ABC1).
     *
     * All are product_type = 'standard' — stock deducted directly on sale.
     * No recipe system used here.
     *
     * Clothing/merchandise → SIZE VARIANTS (S / M / L / XL / 2XL)
     * Groceries, beverages, personal care → no variants
     *
     * expiry_date is NOT set in the seeder — it is recorded per
     * batch when stock is received via GRN from a supplier.
     */
    public function run(): void
    {
        $branch = Branch::where('code', 'ABC1')->first();

        if (!$branch) {
            $this->command->warn('Branch ABC1 not found. Skipping.');
            return;
        }

        $cats         = Category::pluck('id', 'name');
        $productCount = 0;
        $variantCount = 0;

        // ── Helpers ────────────────────────────────────────────────

        $make = function (array $p) use ($cats, $branch, &$productCount): Product {
            $product = Product::firstOrCreate(
                ['barcode' => $p['barcode']],
                [
                    'name'         => $p['name'],
                    'category_id'  => $cats[$p['category']] ?? null,
                    'product_type' => 'standard',
                ]
            );

            ProductStock::updateOrCreate(
                ['product_id' => $product->id, 'branch_id' => $branch->id],
                [
                    'stock'   => $p['stock'],
                    'capital' => $p['capital'],
                    'markup'  => $p['markup'],
                ]
            );

            $productCount++;
            return $product;
        };

        $makeVariants = function (Product $product, array $variants) use ($branch, &$variantCount): void {
            foreach ($variants as $i => $v) {
                $variant = ProductVariant::firstOrCreate(
                    ['product_id' => $product->id, 'name' => $v['name']],
                    [
                        'product_id'  => $product->id,
                        'name'        => $v['name'],
                        'attributes'  => $v['attributes'] ?? [],
                        'extra_price' => $v['extra_price'] ?? 0,
                        'is_available'=> true,
                        'sort_order'  => $i,
                    ]
                );

                ProductVariantStock::updateOrCreate(
                    ['product_variant_id' => $variant->id, 'branch_id' => $branch->id],
                    [
                        'stock'   => $v['stock'],
                        'capital' => $v['capital'],
                        'markup'  => $v['markup'],
                    ]
                );

                $variantCount++;
            }
        };

        // Clothing sizes helper — S/M/L same price, XL +₱20, 2XL +₱40
        $clothingSizes = fn(float $capital, float $markup, int $qty = 10) => [
            ['name' => 'Small (S)',  'attributes' => ['size' => 'S'],  'extra_price' => 0,  'capital' => $capital,      'markup' => $markup, 'stock' => $qty],
            ['name' => 'Medium (M)', 'attributes' => ['size' => 'M'],  'extra_price' => 0,  'capital' => $capital,      'markup' => $markup, 'stock' => $qty],
            ['name' => 'Large (L)',  'attributes' => ['size' => 'L'],  'extra_price' => 0,  'capital' => $capital,      'markup' => $markup, 'stock' => $qty],
            ['name' => 'XL',         'attributes' => ['size' => 'XL'], 'extra_price' => 20, 'capital' => $capital + 10, 'markup' => $markup, 'stock' => $qty],
            ['name' => '2XL',        'attributes' => ['size' => '2XL'],'extra_price' => 40, 'capital' => $capital + 20, 'markup' => $markup, 'stock' => (int) ceil($qty / 2)],
        ];

        // ══════════════════════════════════════════════════════════
        // GROCERIES
        // ══════════════════════════════════════════════════════════
        foreach ([
            ['barcode' => '3000001', 'name' => 'Rice (per kg)',          'capital' => 52.00, 'markup' => 15.38, 'stock' => 200],
            ['barcode' => '3000002', 'name' => 'Canned Sardines 155g',   'capital' => 22.00, 'markup' => 36.36, 'stock' => 100],
            ['barcode' => '3000003', 'name' => 'Canned Tuna 155g',       'capital' => 30.00, 'markup' => 33.33, 'stock' => 100],
            ['barcode' => '3000004', 'name' => 'Corned Beef 260g',       'capital' => 55.00, 'markup' => 27.27, 'stock' => 80],
            ['barcode' => '3000005', 'name' => 'Soy Sauce 250ml',        'capital' => 18.00, 'markup' => 38.89, 'stock' => 60],
            ['barcode' => '3000006', 'name' => 'Vinegar 250ml',          'capital' => 15.00, 'markup' => 46.67, 'stock' => 60],
            ['barcode' => '3000007', 'name' => 'Cooking Oil 1L',         'capital' => 80.00, 'markup' => 25.00, 'stock' => 50],
            ['barcode' => '3000008', 'name' => 'White Sugar 1kg',        'capital' => 65.00, 'markup' => 23.08, 'stock' => 80],
            ['barcode' => '3000009', 'name' => 'Salt 500g',              'capital' => 18.00, 'markup' => 38.89, 'stock' => 80],
            ['barcode' => '3000010', 'name' => 'Instant Noodles (pack)', 'capital' => 12.00, 'markup' => 66.67, 'stock' => 150],
            ['barcode' => '3000011', 'name' => 'Pancit Canton (pack)',   'capital' => 14.00, 'markup' => 57.14, 'stock' => 100],
            ['barcode' => '3000012', 'name' => '3-in-1 Coffee Sachet',   'capital' => 8.00,  'markup' => 87.50, 'stock' => 200],
            ['barcode' => '3000013', 'name' => 'Tomato Ketchup 320g',    'capital' => 42.00, 'markup' => 28.57, 'stock' => 40],
            ['barcode' => '3000014', 'name' => 'Peanut Butter 330g',     'capital' => 68.00, 'markup' => 22.06, 'stock' => 30],
            ['barcode' => '3000015', 'name' => 'Mayonnaise 220ml',       'capital' => 48.00, 'markup' => 25.00, 'stock' => 30],
        ] as $p) {
            $make(array_merge($p, ['category' => 'Groceries']));
        }

        // ══════════════════════════════════════════════════════════
        // BEVERAGES
        // ══════════════════════════════════════════════════════════
        foreach ([
            ['barcode' => '3000020', 'name' => 'Bottled Water 500ml',    'capital' => 8.00,  'markup' => 87.50, 'stock' => 200],
            ['barcode' => '3000021', 'name' => 'Bottled Water 1L',       'capital' => 15.00, 'markup' => 66.67, 'stock' => 100],
            ['barcode' => '3000022', 'name' => 'Canned Soda 330ml',      'capital' => 28.00, 'markup' => 42.86, 'stock' => 72],
            ['barcode' => '3000023', 'name' => 'Juice Tetra Pack 200ml', 'capital' => 14.00, 'markup' => 71.43, 'stock' => 80],
            ['barcode' => '3000024', 'name' => 'Sports Drink 500ml',     'capital' => 38.00, 'markup' => 42.11, 'stock' => 48],
            ['barcode' => '3000025', 'name' => 'Energy Drink 250ml',     'capital' => 48.00, 'markup' => 35.42, 'stock' => 24],
            ['barcode' => '3000026', 'name' => 'Chocolate Drink 180ml',  'capital' => 18.00, 'markup' => 66.67, 'stock' => 60],
        ] as $p) {
            $make(array_merge($p, ['category' => 'Beverages']));
        }

        // ══════════════════════════════════════════════════════════
        // SNACKS
        // ══════════════════════════════════════════════════════════
        foreach ([
            ['barcode' => '3000030', 'name' => 'Potato Chips 60g',       'capital' => 22.00, 'markup' => 59.09, 'stock' => 80],
            ['barcode' => '3000031', 'name' => 'Cheese Curls 75g',       'capital' => 18.00, 'markup' => 66.67, 'stock' => 60],
            ['barcode' => '3000032', 'name' => 'Crackers 250g',          'capital' => 28.00, 'markup' => 42.86, 'stock' => 60],
            ['barcode' => '3000033', 'name' => 'Chocolate Cookies 200g', 'capital' => 38.00, 'markup' => 42.11, 'stock' => 40],
            ['barcode' => '3000034', 'name' => 'Candy Roll (per piece)', 'capital' => 2.00,  'markup' => 150.0, 'stock' => 200],
            ['barcode' => '3000035', 'name' => 'Chocolate Bar 50g',      'capital' => 22.00, 'markup' => 59.09, 'stock' => 60],
            ['barcode' => '3000036', 'name' => 'Gummy Bears 100g',       'capital' => 28.00, 'markup' => 42.86, 'stock' => 40],
        ] as $p) {
            $make(array_merge($p, ['category' => 'Snacks']));
        }

        // ══════════════════════════════════════════════════════════
        // PERSONAL CARE
        // ══════════════════════════════════════════════════════════
        foreach ([
            ['barcode' => '3000040', 'name' => 'Shampoo Sachet',          'capital' => 5.00,  'markup' => 100.0, 'stock' => 200],
            ['barcode' => '3000041', 'name' => 'Conditioner Sachet',      'capital' => 5.00,  'markup' => 100.0, 'stock' => 150],
            ['barcode' => '3000042', 'name' => 'Shampoo 200ml',           'capital' => 78.00, 'markup' => 28.21, 'stock' => 40],
            ['barcode' => '3000043', 'name' => 'Soap Bar 90g',            'capital' => 28.00, 'markup' => 42.86, 'stock' => 80],
            ['barcode' => '3000044', 'name' => 'Toothpaste 75ml',         'capital' => 38.00, 'markup' => 42.11, 'stock' => 60],
            ['barcode' => '3000045', 'name' => 'Toothbrush',              'capital' => 22.00, 'markup' => 59.09, 'stock' => 60],
            ['barcode' => '3000046', 'name' => 'Deodorant Roll-on 40ml',  'capital' => 48.00, 'markup' => 35.42, 'stock' => 40],
            ['barcode' => '3000047', 'name' => 'Feminine Pads (pack)',    'capital' => 48.00, 'markup' => 35.42, 'stock' => 40],
            ['barcode' => '3000048', 'name' => 'Rubbing Alcohol 500ml',   'capital' => 55.00, 'markup' => 27.27, 'stock' => 30],
            ['barcode' => '3000049', 'name' => 'Face Mask (per piece)',   'capital' => 5.00,  'markup' => 100.0, 'stock' => 100],
        ] as $p) {
            $make(array_merge($p, ['category' => 'Personal Care']));
        }

        // ══════════════════════════════════════════════════════════
        // SCHOOL SUPPLIES
        // ══════════════════════════════════════════════════════════
        foreach ([
            ['barcode' => '3000050', 'name' => 'Ballpen (black)',         'capital' => 8.00,  'markup' => 87.50, 'stock' => 200],
            ['barcode' => '3000051', 'name' => 'Ballpen (blue)',          'capital' => 8.00,  'markup' => 87.50, 'stock' => 200],
            ['barcode' => '3000052', 'name' => 'Pencil HB',               'capital' => 5.00,  'markup' => 100.0, 'stock' => 150],
            ['barcode' => '3000053', 'name' => 'Notebook 50 leaves',      'capital' => 28.00, 'markup' => 42.86, 'stock' => 80],
            ['barcode' => '3000054', 'name' => 'Intermediate Pad Paper',  'capital' => 20.00, 'markup' => 50.00, 'stock' => 80],
            ['barcode' => '3000055', 'name' => 'Highlighter',             'capital' => 18.00, 'markup' => 66.67, 'stock' => 60],
            ['barcode' => '3000056', 'name' => 'Correction Tape',         'capital' => 22.00, 'markup' => 59.09, 'stock' => 60],
            ['barcode' => '3000057', 'name' => 'Scissors',                'capital' => 28.00, 'markup' => 42.86, 'stock' => 40],
            ['barcode' => '3000058', 'name' => 'Ruler 30cm',              'capital' => 15.00, 'markup' => 66.67, 'stock' => 40],
            ['barcode' => '3000059', 'name' => 'Folder (per piece)',      'capital' => 8.00,  'markup' => 87.50, 'stock' => 100],
            ['barcode' => '3000060', 'name' => 'Glue Stick',              'capital' => 18.00, 'markup' => 66.67, 'stock' => 60],
        ] as $p) {
            $make(array_merge($p, ['category' => 'School Supplies']));
        }

        // ══════════════════════════════════════════════════════════
        // MERCHANDISE — clothing with SIZE VARIANTS
        // Base product stock = 0; variant stocks carry the real qty.
        // ══════════════════════════════════════════════════════════

        // T-Shirts
        foreach ([
            ['barcode' => '3000070', 'name' => 'Plain T-Shirt (White)', 'capital' => 80.00,  'markup' => 87.50],
            ['barcode' => '3000071', 'name' => 'Plain T-Shirt (Black)', 'capital' => 80.00,  'markup' => 87.50],
            ['barcode' => '3000072', 'name' => 'Plain T-Shirt (Navy)',  'capital' => 80.00,  'markup' => 87.50],
            ['barcode' => '3000073', 'name' => 'Polo Shirt (White)',    'capital' => 120.00, 'markup' => 66.67],
            ['barcode' => '3000074', 'name' => 'Polo Shirt (Blue)',     'capital' => 120.00, 'markup' => 66.67],
        ] as $p) {
            $product = $make(array_merge($p, ['category' => 'Merchandise', 'stock' => 0]));
            $makeVariants($product, $clothingSizes($p['capital'], $p['markup']));
        }

        // Shorts
        foreach ([
            ['barcode' => '3000075', 'name' => 'Basketball Shorts (Black)', 'capital' => 90.00, 'markup' => 77.78],
            ['barcode' => '3000076', 'name' => 'Basketball Shorts (Gray)',  'capital' => 90.00, 'markup' => 77.78],
            ['barcode' => '3000077', 'name' => 'Jogging Shorts',            'capital' => 85.00, 'markup' => 82.35],
        ] as $p) {
            $product = $make(array_merge($p, ['category' => 'Merchandise', 'stock' => 0]));
            $makeVariants($product, $clothingSizes($p['capital'], $p['markup']));
        }

        // Accessories — no size variants
        foreach ([
            ['barcode' => '3000080', 'name' => 'Cap (Snapback)',  'capital' => 80.00,  'markup' => 87.50, 'stock' => 20],
            ['barcode' => '3000081', 'name' => 'Socks (per pair)','capital' => 28.00,  'markup' => 78.57, 'stock' => 60],
            ['barcode' => '3000082', 'name' => 'Tote Bag',        'capital' => 55.00,  'markup' => 81.82, 'stock' => 30],
            ['barcode' => '3000083', 'name' => 'Umbrella',        'capital' => 120.00, 'markup' => 66.67, 'stock' => 15],
        ] as $p) {
            $make(array_merge($p, ['category' => 'Merchandise']));
        }

        $this->command->info("✓ Retail products seeded ({$productCount} products, {$variantCount} variants)");
    }
}
