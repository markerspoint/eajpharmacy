import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMoney } from '../ReceiptTemplate';
import type { Product, CartItem } from '../posTypes';

export default function GroceryLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[];
    cart: CartItem[];
    currency: string;
    onProductClick: (p: Product) => void;
}) {
    return (
        <div className="divide-y divide-border/50">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleMTO && p.stock <= 0;
                const lowStock    = !isBundleMTO && p.stock > 0 && p.stock <= 5;
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors select-none",
                            outStock ? "opacity-40 cursor-not-allowed" : inCart ? "bg-primary/5" : "hover:bg-accent",
                        )}>
                        <div className={cn(
                            "h-9 w-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-sm font-black",
                            inCart ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}>
                            {inCart ? inCart.qty : p.product_img
                                ? <img src={p.product_img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                : <span>{p.name.charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold leading-snug", outStock ? "text-muted-foreground" : "text-foreground")}>
                                {p.name}
                                {p.has_variants && <span className="text-[10px] text-muted-foreground font-normal ml-1">({p.variants.length} var.)</span>}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {p.barcode && <p className="text-[10px] text-muted-foreground font-mono">{p.barcode}</p>}
                                {p.product_type === 'bundle' && <span className="text-[9px] font-bold text-purple-400">BUNDLE</span>}
                                {p.product_type === 'made_to_order' && <span className="text-[9px] font-bold text-cyan-400">MTO</span>}
                            </div>
                        </div>
                        <span className={cn(
                            "text-xs font-semibold shrink-0 tabular-nums",
                            outStock ? "text-destructive" : lowStock ? "text-amber-500" : "text-muted-foreground",
                        )}>
                            {outStock ? "Out" : p.product_type === 'made_to_order' ? 'MTO' : p.product_type === 'bundle' ? 'Bundle' : `${p.stock}`}
                        </span>
                        <span className="text-sm font-black text-primary tabular-nums shrink-0 ml-2">{fmtMoney(p.price, currency)}</span>
                        <div className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            outStock ? "bg-muted/50 text-muted-foreground/30"
                                : inCart ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
                        )}>
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
