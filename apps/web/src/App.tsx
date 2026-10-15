import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { LoadingState } from './components/StorefrontUI'

const Login = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.Login })))
const Register = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.Register })))
const ForgotPassword = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.ForgotPassword })))
const ProductListing = lazy(() => import('./pages/CatalogPages').then((module) => ({ default: module.ProductListing })))
const SearchPage = lazy(() => import('./pages/CatalogPages').then((module) => ({ default: module.SearchPage })))
const ProductDetail = lazy(() => import('./pages/CatalogPages').then((module) => ({ default: module.ProductDetail })))
const CartPage = lazy(() => import('./pages/CartPages').then((module) => ({ default: module.CartPage })))
const AccountPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.AccountPage })))
const AddressesPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.AddressesPage })))
const OrdersPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OrdersPage })))
const WishlistPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.WishlistPage })))
const NotificationsPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.NotificationsPage })))
const SellerApplicationPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.SellerApplicationPage })))
const OrderDetailPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OrderDetailPage })))
const OrderTrackingPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OrderTrackingPage })))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })))
const CheckoutPendingPage = lazy(() => import('./pages/CheckoutResultPages').then((module) => ({ default: module.CheckoutPendingPage })))
const CheckoutSuccessPage = lazy(() => import('./pages/CheckoutResultPages').then((module) => ({ default: module.CheckoutSuccessPage })))
const CheckoutCancelPage = lazy(() => import('./pages/CheckoutResultPages').then((module) => ({ default: module.CheckoutCancelPage })))
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })))
const StoresPage = lazy(() => import('./pages/StorePages').then((module) => ({ default: module.StoresPage })))
const StoreDetailPage = lazy(() => import('./pages/StorePages').then((module) => ({ default: module.StoreDetailPage })))
const AboutPage = lazy(() => import('./pages/ContentPages').then((module) => ({ default: module.AboutPage })))
const ContactPage = lazy(() => import('./pages/ContentPages').then((module) => ({ default: module.ContactPage })))
const FaqPage = lazy(() => import('./pages/ContentPages').then((module) => ({ default: module.FaqPage })))
const PromotionsPage = lazy(() => import('./pages/ContentPages').then((module) => ({ default: module.PromotionsPage })))
const CategoriesPage = lazy(() => import('./pages/ContentPages').then((module) => ({ default: module.CategoriesPage })))

export function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="page-shell"><Suspense fallback={<LoadingState />}><Routes><Route path="/" element={<Home />} /><Route path="/about" element={<AboutPage />} /><Route path="/categories" element={<CategoriesPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/faq" element={<FaqPage />} /><Route path="/promotions" element={<PromotionsPage />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/products" element={<ProductListing />} /><Route path="/products/:slug" element={<ProductDetail />} /><Route path="/stores" element={<StoresPage />} /><Route path="/stores/:slug" element={<StoreDetailPage />} /><Route path="/search" element={<SearchPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout/success" element={<CheckoutSuccessPage />} /><Route path="/checkout/cancel" element={<CheckoutCancelPage />} /><Route path="/checkout/pending" element={<CheckoutPendingPage />} /><Route element={<ProtectedRoute />}><Route path="/account" element={<AccountPage />} /><Route path="/account/addresses" element={<AddressesPage />} /><Route path="/account/wishlist" element={<WishlistPage />} /><Route path="/account/notifications" element={<NotificationsPage />} /><Route path="/account/seller-application" element={<SellerApplicationPage />} /><Route path="/account/orders" element={<OrdersPage />} /><Route path="/account/orders/:id" element={<OrderDetailPage />} /><Route path="/account/orders/:id/tracking" element={<OrderTrackingPage />} /><Route path="/checkout" element={<CheckoutPage />} /></Route><Route path="*" element={<NotFound />} /></Routes></Suspense></main>
      <Footer />
    </BrowserRouter>
  )
}
