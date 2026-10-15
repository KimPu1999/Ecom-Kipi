import { Link } from 'react-router-dom'

export function Unauthorized() { return <section className="admin-card"><h1>Unauthorized</h1><p>Your account does not have admin access.</p><Link to="/admin/login">Try another account</Link></section> }
export function NotFound() { return <section className="admin-card"><h1>Page not found</h1><Link to="/admin">Back to dashboard</Link></section> }
