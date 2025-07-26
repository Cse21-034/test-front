import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/context/CartContext";
import CookieConsent from "react-cookie-consent"; // Added for cookie consent banner

// Import icons
import { Loader2 } from "lucide-react";

// Fallback ShoppingBag SVG
const ShoppingBag = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
  </svg>
);

// Pages
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Admin from "@/pages/Admin";
import About from "@/pages/About";
import Contact from "@/pages/Contact";

// Professional Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-8">
        {/* Logo/Brand Icon */}
        <div className="relative">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          {/* Pulsing ring animation */}
          <div className="absolute inset-0 w-20 h-20 mx-auto rounded-2xl border-2 border-blue-400 animate-ping opacity-20"></div>
        </div>
        
        {/* Brand Name */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Your Store
          </h1>
          <p className="text-slate-500 text-sm">
            Loading your shopping experience...
          </p>
        </div>
        
        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
        
        </div>
      </div>
    </div>
  );
}

// ProtectedRoute wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth;
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/"); // Redirect to landing/home
    }
  }, [isAuthenticated, navigate]);
  
  if (!return isAuthenticated) { return null; // Optionally show spinner or redirect notice
  
  return <Component />;
}

// Main router
function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingScreen />;
  
  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Home : Landing} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/admin" component={() => <ProtectedRoute component={Admin} />} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

// App wrapper
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Toaster />
          <Router />
          {/* Cookie Consent Banner */}
          <CookieConsent
            location="bottom"
            buttonText="Accept Cookies"
            declineButtonText="Decline"
            cookieName="cookieConsent"
            containerClasses="fixed bottom-4 left-0 right-0 mx-auto max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col sm:flex-row items-center justify-between z-50"
            buttonClasses="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            declineButtonClasses="border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 mr-2"
            contentClasses="text-gray-700 dark:text-gray-300 text-sm mb-2 sm:mb-0 sm:mr-4"
            expires={365} // Cookie consent persists for 1 year
            enableDeclineButton={true}
            onAccept={() => {
              console.log("✅ Cookie consent accepted");
              // Trigger auth refresh if needed
              queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            }}
            onDecline={() => {
              console.warn("❌ Cookie consent declined, falling back to JWT or manual cookie enabling");
              // Notify user about limited functionality
              alert(
                "Some features, like login, may require cookies. Please enable third-party cookies in your browser settings or try again later."
              );
              // Optionally redirect to a page explaining how to enable cookies
              // window.location.href = "/cookie-info";
            }}
          >
            This website uses cookies to enable essential features like authentication and cart management. By accepting, you agree to the use of cookies.
          </CookieConsent>
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
