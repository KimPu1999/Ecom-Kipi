import { useEffect, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Edit3, Eye, EyeOff, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { ApiClientError } from '@kipi/api-client'
import { adminApi } from '../services/adminApi'
import type { Brand, Category, Product, ProductImage } from '../types/admin'
import { Card, ConfirmButton, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchBox, StatusBadge } from '../components/ui'

function useSearch() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  return { search, setSearch: (value: string) => { setSearch(value); setPage(1) }, page, setPage }
}

function validationMessage(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    const details = Object.values(error.errors ?? {}).flat().join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }
  return error instanceof Error ? error.message : undefined
}

function CatalogForm({ title, initial, onSubmit, onCancel }: { title?: string; initial: { name: string; slug: string; description?: string | null; color?: string | null; is_active?: boolean; logo_url?: string | null }; onSubmit: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: initial.name, slug: initial.slug, description: initial.description ?? '', color: initial.color ?? '', is_active: initial.is_active ?? true, logo_url: initial.logo_url ?? '' })
  function submit(event: FormEvent) {
    event.preventDefault()
    const data: Record<string, unknown> = { ...form }
    if ('logo_url' in initial) delete data.color
    if ('color' in initial) data.color = form.color || null
    if (!('logo_url' in initial)) delete data.logo_url
    onSubmit(data)
  }
  return <form className="stack-form" aria-label={title} onSubmit={submit}><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Slug<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label>Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>{'color' in initial ? <div className="category-color-field"><label htmlFor="category-color">Category color</label><div><input id="category-color" type="color" value={form.color || '#315CF5'} onChange={(event) => setForm({ ...form, color: event.target.value.toUpperCase() })} /><code>{form.color || 'No color selected'}</code><button className="text-button" type="button" onClick={() => setForm({ ...form, color: '' })}>Clear</button></div><small className="field-help">Used for category accents in supported storefront components.</small></div> : null}{'logo_url' in initial ? <label>Logo URL<input type="url" value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} /></label> : null}<label className="checkbox"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Show category in storefront</label><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save changes</button></div></form>
}

export function CategoriesPage() {
  const { search, setSearch, page, setPage } = useSearch()
  const [editing, setEditing] = useState<Category | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-categories', search, page], queryFn: () => adminApi.categories({ q: search, page: String(page) }), placeholderData: keepPreviousData })
  const mutation = useMutation({ mutationFn: (payload: { id?: number; data: Record<string, unknown> }) => payload.id ? adminApi.updateCategory(payload.id, payload.data) : adminApi.createCategory(payload.data), onSuccess: () => { setEditing(null); client.invalidateQueries({ queryKey: ['admin-categories'] }) } })
  const visibilityMutation = useMutation({ mutationFn: (category: Category) => adminApi.updateCategory(category.id, { is_active: !category.is_active }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-categories'] }) })
  const deleteMutation = useMutation({ mutationFn: adminApi.deleteCategory, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-categories'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Catalog" title="Categories" description="Organize your store, control storefront visibility, and set category accent colors." action={<button className="button primary" onClick={() => setEditing({ id: 0, name: '', slug: '', description: '', color: null, is_active: true, sort_order: 0 })}><Plus size={17} /> New category</button>} />{editing ? <Card><div className="card-heading"><h2>{editing.id ? 'Edit category' : 'New category'}</h2></div><CatalogForm title="Category" initial={editing} onCancel={() => setEditing(null)} onSubmit={(data) => mutation.mutate({ id: editing.id || undefined, data })} /></Card> : null}<Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search categories" /></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Color</th><th>Slug</th><th>Visibility</th><th>Sort order</th><th /></tr></thead><tbody>{query.data.data.map((category) => <tr key={category.id}><td><strong>{category.name}</strong><small>{category.description || 'No description'}</small></td><td><span className="category-color-preview" style={{ backgroundColor: category.color || '#E2E8F0' }} title={category.color || 'No color selected'} aria-label={category.color ? `Category color ${category.color}` : 'No category color'} />{category.color || '—'}</td><td>{category.slug}</td><td><StatusBadge value={category.is_active} /></td><td>{category.sort_order}</td><td className="actions-cell"><button className="text-button" onClick={() => visibilityMutation.mutate(category)} disabled={visibilityMutation.isPending} aria-label={`${category.is_active ? 'Hide' : 'Show'} ${category.name}`}>{category.is_active ? <EyeOff size={15} /> : <Eye size={15} />}{category.is_active ? 'Hide' : 'Show'}</button><button className="icon-button" onClick={() => setEditing(category)} aria-label="Edit category"><Edit3 size={16} /></button><ConfirmButton onConfirm={() => deleteMutation.mutate(category.id)}><Trash2 size={15} /></ConfirmButton></td></tr>)}</tbody></table></div> : <EmptyState title="No categories found" message="Create your first category to organize products." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

export function BrandsPage() {
  const { search, setSearch, page, setPage } = useSearch()
  const [editing, setEditing] = useState<Brand | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-brands', search, page], queryFn: () => adminApi.brands({ q: search, page: String(page) }), placeholderData: keepPreviousData })
  const mutation = useMutation({ mutationFn: (payload: { id?: number; data: Record<string, unknown> }) => payload.id ? adminApi.updateBrand(payload.id, payload.data) : adminApi.createBrand(payload.data), onSuccess: () => { setEditing(null); client.invalidateQueries({ queryKey: ['admin-brands'] }) } })
  const deleteMutation = useMutation({ mutationFn: adminApi.deleteBrand, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-brands'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Catalog" title="Brands" description="Manage the makers represented in your catalog." action={<button className="button primary" onClick={() => setEditing({ id: 0, name: '', slug: '', description: '', logo_url: '', is_active: true })}><Plus size={17} /> New brand</button>} />{editing ? <Card><div className="card-heading"><h2>{editing.id ? 'Edit brand' : 'New brand'}</h2></div><CatalogForm title="Brand" initial={editing} onCancel={() => setEditing(null)} onSubmit={(data) => mutation.mutate({ id: editing.id || undefined, data })} /></Card> : null}<Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search brands" /></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Brand</th><th>Slug</th><th>Status</th><th /></tr></thead><tbody>{query.data.data.map((brand) => <tr key={brand.id}><td><strong>{brand.name}</strong><small>{brand.description || 'No description'}</small></td><td>{brand.slug}</td><td><StatusBadge value={brand.is_active} /></td><td className="actions-cell"><button className="icon-button" onClick={() => setEditing(brand)} aria-label="Edit brand"><Edit3 size={16} /></button><ConfirmButton onConfirm={() => deleteMutation.mutate(brand.id)}><Trash2 size={16} /></ConfirmButton></td></tr>)}</tbody></table></div> : <EmptyState title="No brands found" message="Add a brand to enrich your product catalog." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

export function ProductsPage() {
  const { search, setSearch, page, setPage } = useSearch()
  const [editing, setEditing] = useState<Product | null>(null)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [imageProduct, setImageProduct] = useState<Product | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-products', search, page], queryFn: () => adminApi.products({ q: search, page: String(page) }), placeholderData: keepPreviousData })
  const categories = useQuery({ queryKey: ['admin-categories', 'select'], queryFn: () => adminApi.categories({ per_page: '100' }) })
  const brands = useQuery({ queryKey: ['admin-brands', 'select'], queryFn: () => adminApi.brands({ per_page: '100' }) })
  const mutation = useMutation({ mutationFn: (payload: { id?: number; data: Record<string, unknown> }) => payload.id ? adminApi.updateProduct(payload.id, payload.data) : adminApi.createProduct(payload.data), onSuccess: () => { setEditing(null); client.invalidateQueries({ queryKey: ['admin-products'] }) } })
  const archive = useMutation({ mutationFn: adminApi.archiveProduct, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-products'] }) })
  const variant = useMutation({ mutationFn: (payload: { productId: number; data: Record<string, unknown> }) => adminApi.createVariant(payload.productId, payload.data), onSuccess: () => { setVariantProduct(null); client.invalidateQueries({ queryKey: ['admin-products'] }) } })
  const image = useMutation({ mutationFn: (payload: { productId: number; data: FormData }) => adminApi.createImage(payload.productId, payload.data), onSuccess: () => { setImageProduct(null); client.invalidateQueries({ queryKey: ['admin-products'] }) } })
  const removeImage = useMutation({ mutationFn: adminApi.deleteImage, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-products'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  const blank = { id: 0, name: '', slug: '', description: '', status: 'draft', is_featured: false } as Product
  return <div className="page-stack"><PageHeader eyebrow="Catalog" title="Products" description="Manage publish state, pricing variants, images, and stock-ready catalog records." action={<button className="button primary" onClick={() => setEditing(blank)}><Plus size={17} /> New product</button>} />{editing ? <Card><div className="card-heading"><h2>{editing.id ? 'Edit product' : 'New product'}</h2></div><ProductForm product={editing} categories={categories.data?.data ?? []} brands={brands.data?.data ?? []} onCancel={() => setEditing(null)} onSubmit={(data) => mutation.mutate({ id: editing.id || undefined, data })} /></Card> : null}{variantProduct ? <Card><div className="card-heading"><h2>Add variant to {variantProduct.name}</h2></div><VariantForm onCancel={() => setVariantProduct(null)} onSubmit={(data) => variant.mutate({ productId: variantProduct.id, data })} /></Card> : null}{imageProduct ? <Card><div className="card-heading"><div><span className="eyebrow">Product media</span><h2>Images for {imageProduct.name}</h2></div><span className="muted">JPG, PNG, or WebP · 5 MB max</span></div><ImageManager product={imageProduct} pending={image.isPending} error={validationMessage(image.error)} onCancel={() => setImageProduct(null)} onSubmit={(data) => image.mutate({ productId: imageProduct.id, data })} onDelete={(id) => removeImage.mutate(id)} /></Card> : null}<Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search product name or slug" /></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Variants</th><th>Images</th><th>Status</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.slug}</small></td><td>{product.category?.name ?? '—'}</td><td>{product.variants?.length ?? 0}</td><td>{product.images?.length ?? 0}</td><td><StatusBadge value={product.status} /></td><td className="actions-cell"><button className="text-button" onClick={() => setEditing(product)}><Edit3 size={15} /> Edit</button><button className="text-button" onClick={() => setVariantProduct(product)}><Plus size={15} /> Variant</button><button className="text-button" onClick={() => setImageProduct(product)}><ImagePlus size={15} /> Images</button>{product.status !== 'archived' ? <ConfirmButton onConfirm={() => archive.mutate(product.id)}><Archive size={15} /></ConfirmButton> : null}</td></tr>)}</tbody></table></div> : <EmptyState title="No products found" message="Create a product to start building your catalog." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

function ImageManager({ product, pending, error, onSubmit, onDelete, onCancel }: { product: Product; pending: boolean; error?: string; onSubmit: (data: FormData) => void; onDelete: (id: number) => void; onCancel: () => void }) {
  const [source, setSource] = useState<'upload' | 'url'>('upload')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [altText, setAltText] = useState('')
  const [primary, setPrimary] = useState(false)
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])
  function submit(event: FormEvent) {
    event.preventDefault()
    const data = new FormData()
    if (source === 'upload' && file) data.append('file', file)
    if (source === 'url' && url.trim()) data.append('url', url.trim())
    data.append('alt_text', altText)
    data.append('is_primary', primary ? '1' : '0')
    onSubmit(data)
  }
  const canSubmit = source === 'upload' ? Boolean(file) : Boolean(url.trim())
  return <div className="image-manager"><div className="image-list">{product.images?.map((image: ProductImage) => <div className="detail-line" key={image.id}><div className="existing-image"><img src={image.url} alt={image.alt_text || product.name} /><span>{image.alt_text || image.url}<small>{image.is_primary ? 'Primary image' : 'Gallery image'}</small></span></div><ConfirmButton onConfirm={() => onDelete(image.id)}><Trash2 size={15} /></ConfirmButton></div>)}</div><form className="stack-form" onSubmit={submit}><div className="image-source-tabs" role="tablist" aria-label="Image source"><button type="button" className={source === 'upload' ? 'active' : ''} onClick={() => setSource('upload')}>Upload file</button><button type="button" className={source === 'url' ? 'active' : ''} onClick={() => setSource('url')}>Image URL</button></div>{source === 'upload' ? <label>Choose image file<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : '') }} />{file ? <small className="field-help">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</small> : <small className="field-help">Maximum 5 MB. Use JPG, PNG, or WebP.</small>}</label> : <label>Image URL<input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setPreview(event.target.value) }} placeholder="https://cdn.example.com/product.webp" required /></label>}{preview ? <div className="image-preview"><img src={preview} alt="Selected product preview" onError={() => setPreview('')} /><span>Preview</span></div> : null}<label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder={`Describe ${product.name}`} maxLength={255} /></label><label className="checkbox"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} /> Use as primary product image</label>{error ? <div className="error-box" role="alert">{error}</div> : null}<div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Close</button><button className="button primary" type="submit" disabled={!canSubmit || pending}>{pending ? 'Uploading…' : source === 'upload' ? 'Upload image' : 'Add image URL'}</button></div></form></div>
}

function ProductForm({ product, categories, brands, onSubmit, onCancel }: { product: Product; categories: Category[]; brands: Brand[]; onSubmit: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: product.name, slug: product.slug, description: product.description ?? '', category_id: String(product.category?.id ?? categories[0]?.id ?? ''), brand_id: String(product.brand?.id ?? ''), status: product.status, is_featured: product.is_featured })
  return <form className="stack-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, category_id: Number(form.category_id), brand_id: form.brand_id ? Number(form.brand_id) : null }) }}><div className="form-grid"><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Slug<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label>Category<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Brand<select value={form.brand_id} onChange={(event) => setForm({ ...form, brand_id: event.target.value })}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div><label>Description<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="checkbox"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm({ ...form, is_featured: event.target.checked })} /> Featured product</label><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save product</button></div></form>
}

function VariantForm({ onSubmit, onCancel }: { onSubmit: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ sku: '', price_minor: '', compare_at_price_minor: '', currency: 'MMK', attributes: '{"size":""}', is_active: true })
  return <form className="stack-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, price_minor: Number(form.price_minor), compare_at_price_minor: form.compare_at_price_minor ? Number(form.compare_at_price_minor) : null, attributes: JSON.parse(form.attributes || '{}') }) }}><div className="form-grid"><label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label><label>Price (minor units)<input required type="number" min="0" value={form.price_minor} onChange={(event) => setForm({ ...form, price_minor: event.target.value })} /></label><label>Compare-at price<input type="number" min="0" value={form.compare_at_price_minor} onChange={(event) => setForm({ ...form, compare_at_price_minor: event.target.value })} /></label><label>Currency<input maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label></div><label>Attributes JSON<textarea rows={2} value={form.attributes} onChange={(event) => setForm({ ...form, attributes: event.target.value })} /></label><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Add variant</button></div></form>
}
