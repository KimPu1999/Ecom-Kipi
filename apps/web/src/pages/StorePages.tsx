import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '../services/storefrontApi'
import { EmptyState, ErrorState, LoadingState, PageIntro, ProductCard } from '../components/StorefrontUI'

export function StoresPage() {
  const query = useQuery({ queryKey: ['stores'], queryFn: storefrontApi.stores })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState />
  return <div className="content-section"><PageIntro eyebrow="The marketplace" title="Meet the independent stores behind the collection." description="Browse approved seller storefronts and discover products from businesses you can trust." />{query.data?.data.length ? <div className="product-grid">{query.data.data.map((store) => <Link className="store-card" key={store.id} to={'/stores/' + store.slug}><span className="store-avatar">{store.store_name.slice(0, 1)}</span><strong>{store.store_name}</strong><span>View storefront →</span></Link>)}</div> : <EmptyState title="No stores yet" message="Seller storefronts will appear here after approval." />}</div>
}

export function StoreDetailPage() {
  const { slug = '' } = useParams()
  const query = useQuery({ queryKey: ['store', slug], queryFn: () => storefrontApi.store(slug), enabled: Boolean(slug) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="This store could not be found." />
  const { store, products } = query.data.data
  return <div className="content-section"><Link className="text-link" to="/stores">← All stores</Link><PageIntro eyebrow="Seller storefront" title={store.store_name} description={store.description ?? 'A trusted independent seller on Kipi Marketplace.'} />{products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title="This store is getting ready" message="Products will be available here soon." />}</div>
}
