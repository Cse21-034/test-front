import { createContext, useContext, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ✅ Backend base URL with fallback
const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-qp1o.onrender.com").replace(/\/$/, "");

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  size?: string;
  color?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  isLoading: boolean;
  addToCart: (productId: number, quantity: number, size?: string, color?: string) => void;
  updateQuantity: (id: number, quantity: number) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  itemCount: 0,
  isLoading: false,
  addToCart: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      const res = await fetch(`${backendURL}/api/cart`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const addToCartMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: number; size?: string; color?: string }) => {
      const res = await fetch(`${backendURL}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Add to cart failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Added to cart", description: "Item has been added to your cart." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to cart.",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      const res = await fetch(`${backendURL}/api/cart/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cart item.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${backendURL}/api/cart/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Remove failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Removed from cart", description: "Item removed successfully." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item from cart.",
        variant: "destructive",
      });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${backendURL}/api/cart`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Clear cart failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear cart.",
        variant: "destructive",
      });
    },
  });

  const itemCount = items.reduce((total: number, item: CartItem) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        isLoading,
        addToCart: (productId, quantity, size, color) => {
          addToCartMutation.mutate({ productId, quantity, size, color });
        },
        updateQuantity: (id, quantity) => {
          updateQuantityMutation.mutate({ id, quantity });
        },
        removeItem: (id) => {
          removeItemMutation.mutate(id);
        },
        clearCart: () => {
          clearCartMutation.mutate();
        },
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
