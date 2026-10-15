import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Clock3, Mail, MapPin, MessageCircle, Search, Send, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '../services/storefrontApi'
import { EmptyState, ErrorState, LoadingState, PageIntro, ProductCard, Seo } from '../components/StorefrontUI'

export function AboutPage() {
  return <div className="content-page">
    <Seo title="About Kipi" description="Meet Kipi, a considered marketplace for useful, beautiful everyday goods." />
    <PageIntro eyebrow="Our point of view" title="Shopping should feel a little more human." description="Kipi brings together thoughtful products from independent sellers, with clear information and a calmer way to discover what belongs in your everyday life." />
    <section className="story-grid">
      <div className="story-panel story-panel-dark"><span className="eyebrow">Since 2026</span><h2>Useful things. Good stories. Less noise.</h2><p>We believe the best marketplaces help you make better choices, not more choices. Every seller and product on Kipi is presented with the details you need to buy with confidence.</p><Link className="button light" to="/products">Explore the collection <ArrowRight size={17} /></Link></div>
      <div className="story-stat-grid"><article><strong>01</strong><h3>Curated</h3><p>Collections shaped around real life, not endless scrolling.</p></article><article><strong>02</strong><h3>Transparent</h3><p>Honest pricing, delivery updates, and seller information.</p></article><article><strong>03</strong><h3>Independent</h3><p>A home for small businesses and makers with something worthwhile to share.</p></article><article><strong>04</strong><h3>Considered</h3><p>Support that respects your time from first click to doorstep.</p></article></div>
    </section>
    <section className="content-section compact-section"><div className="section-heading"><div><span className="eyebrow">How Kipi works</span><h2>Made for a more confident purchase.</h2></div></div><div className="value-grid"><article><ShieldCheck size={25} /><h3>Shop securely</h3><p>Payments are initialized and verified by the server. We never store your card details.</p></article><article><Truck size={25} /><h3>Follow every step</h3><p>See order status, shipment events, and delivery updates from your account.</p></article><article><MessageCircle size={25} /><h3>Get human help</h3><p>Questions about an order or a product? Our customer care team is here to help.</p></article></div></section>
  </div>
}

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  function submit(event: FormEvent) {
    event.preventDefault()
    const subject = encodeURIComponent(`Kipi customer message from ${values.name}`)
    const body = encodeURIComponent(`${values.message}\n\nReply to: ${values.email}`)
    window.location.href = `mailto:hello@kipi.example?subject=${subject}&body=${body}`
    setSubmitted(true)
  }
  return <div className="content-page"><Seo title="Contact Kipi" description="Contact Kipi customer care about products, orders, sellers, and delivery." /><PageIntro eyebrow="Customer care" title="We’re here when you need us." description="For order help, product questions, or seller enquiries, send us a note and we’ll point you in the right direction." /><div className="contact-layout"><section className="form-card"><div className="card-heading"><div><span className="eyebrow">Send a message</span><h2>Let’s talk.</h2></div><Send size={22} /></div>{submitted ? <div className="success-box" role="status">Your email app should now be open with a prepared message. If it didn’t open, email hello@kipi.example directly.</div> : <form className="stack-form" onSubmit={submit}><label className="field"><span>Name</span><input required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} autoComplete="name" /></label><label className="field"><span>Email</span><input required type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} autoComplete="email" /></label><label className="field"><span>How can we help?</span><textarea required rows={6} value={values.message} onChange={(event) => setValues({ ...values, message: event.target.value })} /></label><button className="button primary" type="submit">Open email draft <Send size={16} /></button></form>}</section><aside className="contact-details"><article><Mail size={21} /><div><strong>Email</strong><a href="mailto:hello@kipi.example">hello@kipi.example</a></div></article><article><Clock3 size={21} /><div><strong>Hours</strong><span>Mon–Fri · 9:00–17:00</span></div></article><article><MapPin size={21} /><div><strong>Based in</strong><span>Yangon, Myanmar</span></div></article></aside></div></div>
}

export function CategoriesPage() {
  const categories = useQuery({ queryKey: ['categories'], queryFn: storefrontApi.categories })
  return <div className="content-page"><Seo title="Categories · Kipi" description="Browse Kipi products by category." /><PageIntro eyebrow="Browse the collection" title="Find a category that fits your day." description="Start with a collection, then narrow down to the products and variants that suit you." />{categories.isLoading ? <LoadingState /> : categories.isError ? <ErrorState message="Categories are temporarily unavailable." /> : categories.data?.data.length ? <div className="category-landing-grid">{categories.data.data.map((category, index) => <Link className={`category-landing-card category-${(index % 4) + 1}`} to={`/products?category=${category.slug}`} key={category.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{category.name}</h2><p>{category.description || 'Explore products from this collection.'}</p><strong>Shop category <ArrowRight size={16} /></strong></div></Link>)}</div> : <EmptyState title="Categories are coming soon" message="There are no active product categories to display yet." />}</div>
}

export function FaqPage() {
  const questions = [
    ['How do I place an order?', 'Add a product to your cart, review your delivery address and shipping method, then continue to the secure payment provider. Your order is only considered paid after the provider confirms it to Kipi.'],
    ['Can I change or cancel an order?', 'Contact customer care as soon as possible with your order number. We will check the fulfillment status and explain the available options.'],
    ['How do I track delivery?', 'Open Account → Orders, choose an order, and select tracking. Shipment events appear as the carrier shares them with Kipi.'],
    ['Are card details stored by Kipi?', 'No. Kipi does not store payment card details. Payment is initialized server-side and verified by the payment provider.'],
    ['How can I become a seller?', 'Create a customer account, open the seller application from your account, and submit your business information. Seller access is only enabled after Super Admin approval.'],
    ['What if an item is unavailable?', 'Stock is checked again during cart and checkout operations. If a variant sells out, the API will prevent the order and show an updated availability message.'],
  ]
  const [search, setSearch] = useState('')
  const visibleQuestions = useMemo(() => questions.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(search.toLowerCase().trim())), [questions, search])
  return <div className="content-page"><Seo title="FAQ · Kipi" description="Answers to common Kipi shopping, payment, delivery, and seller questions." /><PageIntro eyebrow="Help center" title="Answers, before you ask." description="A few useful details about shopping, payments, delivery, and selling on Kipi." /><label className="search-input faq-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions" aria-label="Search frequently asked questions" /></label><div className="faq-list">{visibleQuestions.length ? visibleQuestions.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>) : <EmptyState title="No matching questions" message="Try another search or contact customer care." action={<Link className="button secondary" to="/contact">Contact care</Link>} />}</div><div className="callout"><Sparkles size={22} /><div><strong>Still need a hand?</strong><p>We’re happy to help with a specific order or product.</p></div><Link className="text-link" to="/contact">Contact care <ArrowRight size={16} /></Link></div></div>
}

export function PromotionsPage() {
  const products = useQuery({ queryKey: ['promotion-products'], queryFn: () => storefrontApi.products({ featured: 1, per_page: 8 }) })
  return <div className="content-page"><Seo title="Promotions · Kipi" description="Discover current Kipi offers and carefully selected featured products." /><section className="promotion-hero"><div><span className="eyebrow">The Kipi edit</span><h1>Good finds, better timing.</h1><p>Explore featured products and seasonal offers from sellers across the marketplace. Availability and final pricing are always confirmed by the API at checkout.</p><Link className="button primary" to="/products?featured=1">Shop featured <ArrowRight size={17} /></Link></div><div className="promotion-orb"><Sparkles size={54} /><span>CURATED<br />OFFERS</span></div></section><div className="offer-grid"><article><strong>Free delivery</strong><p>On qualifying orders over 100,000 MMK.</p></article><article><strong>New seller finds</strong><p>Discover independent stores joining Kipi.</p></article><article><strong>Secure checkout</strong><p>Verified payments with no stored card details.</p></article></div><section className="content-section compact-section"><div className="section-heading"><div><span className="eyebrow">Featured now</span><h2>Worth a closer look.</h2></div><Link className="text-link" to="/products?featured=1">See all <ArrowRight size={16} /></Link></div>{products.isLoading ? <LoadingState /> : products.isError ? <ErrorState message="Featured products are temporarily unavailable." /> : products.data?.data.length ? <div className="product-grid">{products.data.data.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <EmptyState title="New offers are on the way" message="Check back soon for the next Kipi edit." />}</section></div>
}
