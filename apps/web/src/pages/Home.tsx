import { ArrowRight, CheckCircle2, Headphones, MapPin, PackageCheck, ShieldCheck, Store, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '../services/storefrontApi'
import { EmptyState, ErrorState, LoadingState, ProductCard, ProductImage, Seo } from '../components/StorefrontUI'
import { useLanguage } from '../../../../packages/i18n/src'

export function Home() {
  const { t } = useLanguage()
  const categories = useQuery({ queryKey: ['categories'], queryFn: storefrontApi.categories })
  const featured = useQuery({ queryKey: ['featured-products'], queryFn: storefrontApi.featured })
  const newest = useQuery({ queryKey: ['newest-products'], queryFn: () => storefrontApi.products({ sort: 'latest', per_page: 12 }) })
  const brands = useQuery({ queryKey: ['brands'], queryFn: storefrontApi.brands })
  const stores = useQuery({ queryKey: ['stores'], queryFn: storefrontApi.stores })

  const heroProduct = featured.data?.data.find((product) => product.images?.[0])
  const deals = newest.data?.data.filter((product) => {
    const variant = product.variants?.[0]
    return Boolean(variant && variant.compare_at_price_minor && variant.compare_at_price_minor > variant.price_minor)
  }).slice(0, 4) ?? []

  return <div className="home-page">
    <Seo title="THANGPC · Everyday goods, selected with care" description="Discover products from approved sellers on THANGPC." />

    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy">
        <span className="eyebrow">{t('Kipi marketplace')}</span>
        <h1 id="home-hero-title">{t('Shop with confidence.')}</h1>
        <p>{t('Discover useful products from approved sellers, with clear details and secure checkout.')}</p>
        <div className="actions">
          <Link className="button light" to="/products">{t('Shop now')} <ArrowRight size={17} /></Link>
          <Link className="button hero-secondary-button" to="/products">{t('Explore products')}</Link>
        </div>
        <div className="home-hero-note"><ShieldCheck size={16} />{t('Secure checkout with order visibility')}</div>
      </div>
      <div className="home-hero-visual" aria-label={heroProduct ? heroProduct.name : t('Kipi marketplace')}>
        {heroProduct ? <ProductImage url={heroProduct.images?.[0]?.url} alt={heroProduct.images?.[0]?.alt_text || heroProduct.name} fallback={heroProduct.name.slice(0, 1)} loading="eager" /> : <div className="home-hero-placeholder"><Store size={42} /><span>{t('Explore the marketplace')}</span></div>}
        {heroProduct ? <div className="home-hero-product"><span>{t('Featured product')}</span><strong>{heroProduct.name}</strong></div> : null}
      </div>
    </section>

    <section className="home-benefit-strip" aria-label={t('Marketplace benefits')}>
      <span><ShieldCheck size={18} />{t('Secure checkout')}</span>
      <span><PackageCheck size={18} />{t('Order tracking')}</span>
      <span><Headphones size={18} />{t('Customer support')}</span>
      <span><CheckCircle2 size={18} />{t('Approved marketplace sellers')}</span>
    </section>

    <section className="home-section" aria-labelledby="home-categories-title">
      <div className="home-section-heading"><div><span className="eyebrow">{t('Browse the marketplace')}</span><h2 id="home-categories-title">{t('Shop by category.')}</h2></div><Link className="text-link" to="/categories">{t('View all categories')} <ArrowRight size={16} /></Link></div>
      {categories.isLoading ? <LoadingState label={t('Loading categories…')} /> : categories.isError ? <ErrorState message={t('Categories are temporarily unavailable.')} /> : categories.data?.data.length ? <div className="home-category-grid">{categories.data.data.slice(0, 8).map((category, index) => <Link className={'home-category-card home-category-' + ((index % 4) + 1)} style={{ borderTopColor: category.color || undefined }} key={category.id} to={'/products?category=' + category.slug}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{category.name}</h3><small>{t('Explore products')} <ArrowRight size={14} /></small></div></Link>)}</div> : <EmptyState title={t('No categories available')} message={t('Product categories will appear here when they are configured.')} action={<Link className="button secondary" to="/products">{t('Browse products')}</Link>} />}
    </section>

    {deals.length ? <section className="home-section home-section-surface" aria-labelledby="home-deals-title"><div className="home-section-heading"><div><span className="eyebrow">{t('Real comparison prices')}</span><h2 id="home-deals-title">{t('Special offers.')}</h2></div><Link className="text-link" to="/products">{t('Shop all')} <ArrowRight size={16} /></Link></div><div className="product-grid">{deals.map((product) => <ProductCard key={product.id} product={product} />)}</div></section> : null}

    <section className="home-section" aria-labelledby="home-featured-title">
      <div className="home-section-heading"><div><span className="eyebrow">{t('Selected from the catalog')}</span><h2 id="home-featured-title">{t('Featured products.')}</h2></div><Link className="text-link" to="/products?featured=1">{t('View all')} <ArrowRight size={16} /></Link></div>
      {featured.isLoading ? <LoadingState label={t('Loading featured products…')} /> : featured.isError ? <ErrorState message={t('Featured products are temporarily unavailable.')} /> : featured.data?.data.length ? <div className="product-grid">{featured.data.data.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title={t('No featured products yet')} message={t('Approved products will appear here when they are featured.')} action={<Link className="button secondary" to="/products">{t('Browse all products')}</Link>} />}
    </section>

    <section className="home-section home-section-surface" aria-labelledby="home-new-title">
      <div className="home-section-heading"><div><span className="eyebrow">{t('Recently added')}</span><h2 id="home-new-title">{t('New arrivals.')}</h2></div><Link className="text-link" to="/products?sort=latest">{t('View all')} <ArrowRight size={16} /></Link></div>
      {newest.isLoading ? <LoadingState label={t('Loading new arrivals…')} /> : newest.isError ? <ErrorState message={t('New arrivals are temporarily unavailable.')} /> : newest.data?.data.length ? <div className="product-grid">{newest.data.data.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title={t('No products available')} message={t('New products will appear here when they are published by approved sellers.')} action={<Link className="button primary" to="/products">{t('Browse products')}</Link>} />}
    </section>

    <section className="home-discovery-section" aria-labelledby="home-discovery-title">
      <div className="home-section-heading"><div><span className="eyebrow">{t('Discover the marketplace')}</span><h2 id="home-discovery-title">{t('Explore brands and stores.')}</h2></div><Link className="text-link" to="/stores">{t('View stores')} <ArrowRight size={16} /></Link></div>
      <div className="home-discovery-grid">
        <div className="home-discovery-column"><div className="home-discovery-heading"><Tags size={19} /><h3>{t('Brands')}</h3></div>{brands.isLoading ? <LoadingState label={t('Loading…')} /> : brands.isError ? <ErrorState message={t('Unable to load this data.')} /> : brands.data?.data.length ? <div className="home-brand-list">{brands.data.data.slice(0, 6).map((brand) => <Link key={brand.id} to={'/products?brand=' + brand.slug}><span className="home-brand-mark">{brand.name.slice(0, 1)}</span><strong>{brand.name}</strong><ArrowRight size={15} /></Link>)}</div> : <p className="muted">{t('No brands available')}</p>}</div>
        <div className="home-discovery-column"><div className="home-discovery-heading"><Store size={19} /><h3>{t('Stores')}</h3></div>{stores.isLoading ? <LoadingState label={t('Loading…')} /> : stores.isError ? <ErrorState message={t('Unable to load this data.')} /> : stores.data?.data.length ? <div className="home-store-list">{stores.data.data.slice(0, 4).map((store) => <Link key={store.id} to={'/stores/' + store.slug}><span className="home-store-avatar">{store.store_name.slice(0, 1)}</span><span><strong>{store.store_name}</strong><small>{t('Visit store')}</small></span><ArrowRight size={15} /></Link>)}</div> : <p className="muted">{t('No stores available')}</p>}</div>
      </div>
    </section>

    <section className="home-support-section" aria-labelledby="home-support-title">
      <div><span className="eyebrow">{t('Shopping support')}</span><h2 id="home-support-title">{t('Everything you need to shop clearly.')}</h2><p>{t('Find products from approved sellers, review order updates, and reach customer support when you need help.')}</p></div>
      <div className="home-support-links"><Link to="/account/orders"><MapPin size={17} /><span><strong>{t('Order tracking')}</strong><small>{t('Follow your order and shipment status.')}</small></span><ArrowRight size={15} /></Link><Link to="/contact"><Headphones size={17} /><span><strong>{t('Customer support')}</strong><small>{t('Get help with orders and products.')}</small></span><ArrowRight size={15} /></Link><Link to="/faq"><CheckCircle2 size={17} /><span><strong>{t('Help center & FAQ')}</strong><small>{t('Find answers to common questions.')}</small></span><ArrowRight size={15} /></Link></div>
    </section>
  </div>
}
