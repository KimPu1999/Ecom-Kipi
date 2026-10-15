import { Link } from 'react-router-dom'

export function Navigation() {
  return <nav aria-label="Primary navigation"><Link to="/products">Products</Link><Link to="/cart">Cart</Link><Link to="/account">Account</Link></nav>
}
