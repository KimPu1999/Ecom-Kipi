import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export function Products() {
  return <section className="placeholder"><p className="eyebrow">Catalog</p><h1>Products are coming soon.</h1><p>The product browsing foundation is ready for the Phase 3 catalog API.</p></section>
}

export function Cart() {
  return <section className="placeholder"><p className="eyebrow">Cart</p><h1>Your cart is empty.</h1><p>Cart persistence and checkout will be connected to the Laravel API next.</p></section>
}

export function Account() {
  const { user, clear } = useAuthStore()
  return <section className="placeholder"><p className="eyebrow">Account</p><h1>Hello, {user?.name}.</h1><p>{user?.email}</p><div className="actions"><button className="button secondary" onClick={clear}>Sign out</button><Link className="button primary" to="/">Continue shopping</Link></div></section>
}

export function NotFound() {
  return <section className="placeholder"><p className="eyebrow">404</p><h1>That page wandered off.</h1><Link className="button primary" to="/">Return home</Link></section>
}
