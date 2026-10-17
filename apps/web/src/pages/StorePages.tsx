import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Search, Store, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '../services/storefrontApi'
import { EmptyState, ErrorState, LoadingState, Pagination, ProductCard, Seo } from '../components/StorefrontUI'
import { useLanguage } from '../../../../packages/i18n/src'
import { mediaUrl } from '../lib/media'

export function StoresPage() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const query = useQuery({ queryKey: ['stores'], queryFn: storefrontApi.stores })
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const categories = useQuery({ queryKey: ['categories'], queryFn: storefrontApi.categories })
  const stores = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase()
    return [...(query.data?.data ?? [])]
      .filter((store) => !normalized || store.store_name.toLocaleLowerCase().includes(normalized))
      .sort((left, right) => sort === 'name-desc' ? right.store_name.localeCompare(left.store_name) : left.store_name.localeCompare(right.store_name))
  }, [query.data?.data, search, sort])

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value.trim()) next.set(name, value)
    else next.delete(name)
    setParams(next)
  }

  function clearFilters() {
    setParams({})
  }

  return <div className="shop-page">
    <Seo title={t('Discover Shops')} description={t('Explore approved seller stores and discover products across the Kipi marketplace.')} />
    <section className="shop-hero" aria-labelledby="shop-title">
      <div className="shop-hero-copy"><span className="eyebrow">{t('The Kipi marketplace')}</span><h1 id="shop-title">{t('Discover Shops')}</h1><p>{t('Explore approved seller stores and find products from businesses across the marketplace.')}</p><Link className="button light" to="/products">{t('Browse products')} <ArrowRight size={16} /></Link></div>
      <div className="shop-hero-mark" aria-hidden="true"><Store size={42} /><span>{t('Independent stores')}</span></div>
    </section>

    <section className="shop-discovery" aria-labelledby="shop-directory-title">
      <div className="shop-section-heading"><div><span className="eyebrow">{t('All shops')}</span><h2 id="shop-directory-title">{t('Find your next store.')}</h2></div><span className="shop-result-count">{stores.length} {t('stores')}</span></div>
      <div className="shop-toolbar">
        <label className="shop-search"><Search size={17} /><span className="visually-hidden">{t('Search stores')}</span><input value={search} onChange={(event) => updateParam('q', event.target.value)} placeholder={t('Search stores by name')} /></label>
        {search ? <button className="shop-clear" type="button" onClick={() => updateParam('q', '')}><X size={15} />{t('Clear search')}</button> : null}
        <label className="shop-sort"><span>{t('Sort')}</span><select value={sort} onChange={(event) => updateParam('sort', event.target.value)}><option value="name">{t('Name A–Z')}</option><option value="name-desc">{t('Name Z–A')}</option></select></label>
        {search || sort !== 'name' ? <button className="text-button" type="button" onClick={clearFilters}>{t('Clear all')}</button> : null}
      </div>
      {categories.data?.data.length ? <div className="shop-category-row" aria-label={t('Browse products by category')}><span>{t('Browse products by category')}</span>{categories.data.data.slice(0, 6).map((category) => <Link className="shop-category-chip" key={category.id} to={'/products?category=' + encodeURIComponent(category.slug)}>{category.name}</Link>)}</div> : null}
      {query.isLoading ? <LoadingState label={t('Loading stores…')} /> : query.isError ? <div className="shop-feedback"><ErrorState message={t('Stores are temporarily unavailable.')} /><button className="button secondary" type="button" onClick={() => query.refetch()}>{t('Try again')}</button></div> : stores.length ? <div className="shop-store-grid">{stores.map((store) => { const logo = mediaUrl(store.logo_path); return <Link className="shop-store-card" key={store.id} to={'/stores/' + store.slug}>{logo ? <img className="shop-store-avatar shop-store-logo" src={logo} alt="" loading="lazy" /> : <span className="shop-store-avatar" aria-hidden="true">{store.store_name.trim().slice(0, 1).toUpperCase()}</span>}<span className="shop-store-copy"><strong>{store.store_name}</strong><small>{store.products_count !== undefined ? `${store.products_count} ${t('Products').toLocaleLowerCase()}` : t('Seller storefront')}</small></span><span className="shop-store-action">{t('Visit shop')} <ArrowRight size={15} /></span></Link> })}</div> : <EmptyState title={search ? t('No stores match your search') : t('No stores yet')} message={search ? t('Try a different store name or clear the search.') : t('Approved seller storefronts will appear here when they are available.')} action={search ? <button className="button secondary" type="button" onClick={clearFilters}>{t('Clear search')}</button> : null} />}
    </section>
    <section className="shop-seller-cta" aria-labelledby="shop-seller-title"><div><span className="eyebrow">{t('For sellers')}</span><h2 id="shop-seller-title">{t('Bring your store to Kipi.')}</h2><p>{t('Apply through the existing seller onboarding flow and manage your store after approval.')}</p></div><Link className="button primary" to="/account/seller-application">{t('Become a seller')} <ArrowRight size={16} /></Link></section>
  </div>
}

export function StoreDetailPage() {
  const { t } = useLanguage()
  const { slug = '' } = useParams()
  const [productSort, setProductSort] = useState('featured')
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const query = useQuery({ queryKey: ['store', slug, page], queryFn: () => storefrontApi.store(slug, page), enabled: Boolean(slug) })
  const products = query.data?.data.products ?? []
  const visibleProducts = useMemo(() => {
    return [...products].sort((left, right) => {
      if (productSort === 'price-low') return (left.variants?.[0]?.price_minor ?? Number.MAX_SAFE_INTEGER) - (right.variants?.[0]?.price_minor ?? Number.MAX_SAFE_INTEGER)
      if (productSort === 'price-high') return (right.variants?.[0]?.price_minor ?? 0) - (left.variants?.[0]?.price_minor ?? 0)
      if (productSort === 'featured' && left.is_featured !== right.is_featured) return left.is_featured ? -1 : 1
      return left.name.localeCompare(right.name)
    })
  }, [productSort, products])
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message={t('This store could not be found.')} />
  const { store } = query.data.data

  return <div className="store-detail-page">
    <Seo title={store.store_name} description={store.description ?? t('Products from this seller on the Kipi marketplace.')} />
    <Link className="store-detail-back" to="/stores"><ArrowLeft size={15} /> {t('All shops')}</Link>
    <section className="store-detail-hero">{store.banner_path ? <img className="store-detail-banner" src={mediaUrl(store.banner_path) ?? ''} alt="" /> : null}<div className="store-detail-hero-content">{store.logo_path ? <img className="store-detail-avatar store-detail-logo" src={mediaUrl(store.logo_path) ?? ''} alt="" /> : <span className="store-detail-avatar" aria-hidden="true">{store.store_name.trim().slice(0, 1).toUpperCase()}</span>}<div><span className="eyebrow">{t('Seller storefront')}</span><h1>{store.store_name}</h1><p>{store.description ?? t('Explore products from this seller on Kipi.')}</p></div></div></section>
    <section className="store-detail-products" aria-labelledby="store-products-title"><div className="shop-section-heading"><div><span className="eyebrow">{t('Store collection')}</span><h2 id="store-products-title">{t('Products from this shop')}</h2></div><span className="shop-result-count">{query.data?.data.meta?.total ?? products.length} {t('Products').toLocaleLowerCase()}</span></div><div className="store-detail-toolbar"><label className="shop-sort"><span>{t('Sort')}</span><select value={productSort} onChange={(event) => setProductSort(event.target.value)}><option value="featured">{t('Featured order')}</option><option value="name">{t('Name A–Z')}</option><option value="price-low">{t('Price low to high')}</option><option value="price-high">{t('Price high to low')}</option></select></label></div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title={t('This store is getting ready')} message={t('Products from this shop will appear here when available.')} />}{query.data?.data.meta?.last_page && query.data.data.meta.last_page > 1 ? <Pagination page={query.data.data.meta.current_page} pages={query.data.data.meta.last_page} onChange={(nextPage) => setParams({ page: String(nextPage) })} /> : null}</section>
  </div>
}
