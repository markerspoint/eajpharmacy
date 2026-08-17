import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMoney } from '../ReceiptTemplate';
import type { Product, CartItem } from '../posTypes';

export default function GridLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[];
    cart: CartItem[];
    currency: string;
    onProductClick: (p: Product) => void;
}) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleMTO && p.stock <= 0;
                const lowStock    = !isBundleMTO && p.stock > 0 && p.stock <= 5;
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn(
                            "relative flex flex-col rounded-xl border p-2.5 text-left transition-all overflow-hidden",
                            outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                : inCart ? "border-primary/60 bg-primary/5 shadow-md"
                                : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
                        )}>
                        <div className="aspect-square w-full bg-muted/40 overflow-hidden rounded-md mb-2 shrink-0">
                            {p.product_img
                                ? <img src={p.product_img} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center"><Package className="h-7 w-7 text-muted-foreground/25" /></div>}
                        </div>
                        {inCart && (
                            <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow">
                                {inCart.qty}
                            </div>
                        )}
                        {outStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                                <span className="text-[9px] font-black text-destructive uppercase tracking-widest bg-background/80 px-2 py-0.5 rounded">Out</span>
                            </div>
                        )}
                        <p title={p.name} className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">{p.name}</p>
                        <div className="flex items-center justify-between mt-1.5 gap-1 shrink-0">
                            <span className="text-xs font-bold text-primary tabular-nums">{fmtMoney(p.price, currency)}</span>
                            <span className={cn("text-[10px] font-medium shrink-0", lowStock ? "text-amber-500" : "text-muted-foreground")}>
                                {p.product_type === 'made_to_order' ? 'MTO' : p.product_type === 'bundle' ? '📦' : p.stock}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {p.has_variants && <p className="text-[9px] text-muted-foreground">{p.variants.length} var.</p>}
                            {p.product_type === 'bundle' && p.bundle_items && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold">Bundle ×{p.bundle_items.length}</span>
                            )}
                            {p.product_type === 'made_to_order' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold">MTO</span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
