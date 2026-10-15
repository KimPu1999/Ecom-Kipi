import { Link } from 'react-router-dom'

export function NotFound() {
  return <section className="narrow-page not-found"><span className="eyebrow">404 · Page not found</span><h1>That page wandered off.</h1><p>Let’s get you back to the good stuff.</p><div className="actions"><Link className="button primary" to="/">Return home</Link><Link className="button secondary" to="/products">Browse products</Link></div></section>
}
