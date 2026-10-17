import { Headphones, Heart, Languages, Mail, Menu, Moon, Search, ShieldCheck, ShoppingBag, Sun, UserRound, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import { SearchInput } from './StorefrontUI'
import { LanguageSwitcher, useLanguage } from '../../../../packages/i18n/src'
import { Logo } from './Logo'

export function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { t } = useLanguage()
  const categoryRef = useRef<HTMLDivElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('kipi.theme') === 'dark')
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() ?? ''

  const cart = useQuery({ queryKey: ['cart'], queryFn: storefrontApi.cart, enabled: Boolean(user) })
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: storefrontApi.wishlist, enabled: Boolean(user) })
  const categories = useQuery({ queryKey: ['categories'], queryFn: storefrontApi.categories })
  const brands = useQuery({ queryKey: ['brands'], queryFn: storefrontApi.brands, enabled: categoriesOpen })
  const stores = useQuery({ queryKey: ['stores'], queryFn: storefrontApi.stores, enabled: categoriesOpen })

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (categoryRef.current && event.target instanceof Node && !categoryRef.current.contains(event.target)) setCategoriesOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setCategoriesOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (value) navigate('/search?q=' + encodeURIComponent(value))
  }

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('kipi.theme', next ? 'dark' : 'light')
  }

  function closeNavigation() {
    setMobileOpen(false)
    setCategoriesOpen(false)
  }

  const count = (value: number) => value > 0 ? <small>{value}</small> : null
  const primaryLinks = [
    { to: '/', label: t('Home') },
    { to: '/products', label: t('Product') },
    { to: '/stores', label: t('Shop') },
    { to: '/about', label: t('About') },
    { to: '/contact', label: t('Contact') },
  ]

  return <header className="site-header marketplace-header">
    <div className="marketplace-utility-bar">
      <div className="marketplace-utility-inner">
        <span className="marketplace-utility-item"><ShieldCheck size={15} aria-hidden="true" />{t('Secure payment')}</span>
        <Link className="marketplace-utility-item" to="/contact"><Headphones size={15} aria-hidden="true" />{t('Customer support')}</Link>
        {supportEmail ? <a className="marketplace-utility-item" href={`mailto:${supportEmail}`}><Mail size={15} aria-hidden="true" />{supportEmail}</a> : null}
        <div className="marketplace-language"><Languages size={15} aria-hidden="true" /><LanguageSwitcher /></div>
      </div>
    </div>

    <div className="marketplace-main-row">
      <button className="icon-button marketplace-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label={t('Open menu')} aria-expanded={mobileOpen}>
        <Menu size={19} aria-hidden="true" />
      </button>
      <Link className="brand marketplace-brand" to="/" aria-label="THANGPC home"><Logo className="brand-logo" /></Link>

      <nav className={'marketplace-primary-nav' + (mobileOpen ? ' mobile-open' : '')} aria-label="Primary navigation">
        <div className="marketplace-mobile-nav-heading"><strong>{t('Menu')}</strong><button className="icon-button" type="button" onClick={closeNavigation} aria-label={t('Close menu')}><X size={19} /></button></div>
        {primaryLinks.map((link) => <Link key={link.to} onClick={closeNavigation} to={link.to}>{link.label}</Link>)}
      </nav>

      <div className="marketplace-header-actions">
        <button className="icon-button marketplace-theme-toggle" type="button" onClick={toggleTheme} aria-label={t('Toggle theme')}>
          {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        <Link className="marketplace-header-action" to={user ? '/account' : '/login'} aria-label={user ? t('Account') : t('Sign in')}>
          <UserRound size={18} aria-hidden="true" /><span>{user ? t('Account') : t('Sign in')}</span>
        </Link>
        <Link className="marketplace-header-action" to={user ? '/account/wishlist' : '/login'} aria-label={t('Wishlist')}>
          <span className="marketplace-badge-wrap"><Heart size={18} aria-hidden="true" />{user && wishlist.data ? count(wishlist.data.data.product_ids.length) : null}</span><span>{t('Wishlist')}</span>
        </Link>
        <Link className="marketplace-header-action" to="/cart" aria-label={t('Shopping cart')}>
          <span className="marketplace-badge-wrap"><ShoppingBag size={18} aria-hidden="true" />{user && cart.data ? count(cart.data.data.item_count) : null}</span><span>{t('Cart')}</span>
        </Link>
      </div>
    </div>

    <div className="marketplace-search-row">
      <div className="marketplace-category-control" ref={categoryRef}>
        <button className="marketplace-category-trigger" type="button" onClick={() => setCategoriesOpen((value) => !value)} aria-expanded={categoriesOpen} aria-controls="marketplace-category-menu">
          <Menu size={17} aria-hidden="true" /><span>{t('All Categories')}</span><span aria-hidden="true">⌄</span>
        </button>
        {categoriesOpen ? <div className="marketplace-category-menu" id="marketplace-category-menu">
          <section>
            <h2>{t('Categories')}</h2>
            {categories.isLoading ? <span className="marketplace-menu-status">{t('Loading categories…')}</span> : categories.isError ? <span className="marketplace-menu-status">{t('Categories unavailable.')}</span> : categories.data?.data.map((category) => <Link key={category.id} to={'/products?category=' + category.slug} onClick={closeNavigation}>{category.name}</Link>)}
          </section>
          <section>
            <h2>{t('Brands')}</h2>
            {brands.isLoading ? <span className="marketplace-menu-status">{t('Loading…')}</span> : brands.isError ? <span className="marketplace-menu-status">{t('Unable to load this data.')}</span> : brands.data?.data.length ? brands.data.data.map((brand) => <Link key={brand.id} to={'/products?brand=' + brand.slug} onClick={closeNavigation}>{brand.name}</Link>) : <span className="marketplace-menu-status">{t('No data available')}</span>}
          </section>
          <section>
            <h2>{t('Stores')}</h2>
            {stores.isLoading ? <span className="marketplace-menu-status">{t('Loading…')}</span> : stores.isError ? <span className="marketplace-menu-status">{t('Unable to load this data.')}</span> : stores.data?.data.length ? stores.data.data.map((store) => <Link key={store.id} to={'/stores/' + store.slug} onClick={closeNavigation}>{store.store_name}</Link>) : <span className="marketplace-menu-status">{t('No data available')}</span>}
          </section>
        </div> : null}
      </div>

      <form className="marketplace-search-form" onSubmit={submitSearch} role="search">
        <SearchInput value={query} onChange={setQuery} placeholder={t('Search products, brands, sellers...')} />
        {query ? <button className="marketplace-search-clear" type="button" onClick={() => setQuery('')} aria-label={t('Clear search')}><X size={15} aria-hidden="true" /></button> : null}
        <button className="button primary marketplace-search-submit" type="submit"><Search size={16} aria-hidden="true" /><span>{t('Search')}</span></button>
      </form>
    </div>
  </header>
}
