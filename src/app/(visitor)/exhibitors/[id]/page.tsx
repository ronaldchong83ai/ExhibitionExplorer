'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { Exhibitor, Product, PurchaseConversion } from '@/types';

const getTrophyEmoji = (trophy: string | boolean | undefined | null): string => {
  if (!trophy) return '';
  if (trophy === 'gold' || trophy === true || trophy === 'true') return '🏆';
  if (trophy === 'silver') return '🥈';
  if (trophy === 'bronze') return '🥉';
  return '';
};

export default function ExhibitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [exhibitor, setExhibitor] = useState<Exhibitor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [conversions, setConversions] = useState<PurchaseConversion[]>([]);
  const [isFavourite, setIsFavourite] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Product management modal / form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    title: '',
    description: '',
    details: '',
    imageUrl: '',
  });
  const [productConversions, setProductConversions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const refreshExhibitorData = async () => {
    const q = search ? `?q=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/exhibitors/${id}${q}`);
    const data = await res.json();
    if (data.success) {
      setExhibitor(data.data.exhibitor);
      setProducts(data.data.products);
      if (data.data.conversions) {
        setConversions(data.data.conversions);
      }
    }
  };

  useEffect(() => {
    Promise.all([
      refreshExhibitorData(),
      fetch(`/api/favourites?type=EXHIBITOR&targetId=${id}`).then(r => r.json()),
      fetch(`/api/auth/session`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([_, favData, sessionData]) => {
      if (favData.success) setIsFavourite(favData.data);
      if (sessionData.success) setUser(sessionData.data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!loading) {
      refreshExhibitorData();
    }
  }, [search]);

  const toggleFavourite = async () => {
    const method = isFavourite ? 'DELETE' : 'POST';
    const res = await fetch('/api/favourites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'EXHIBITOR', targetId: id }),
    });
    const data = await res.json();
    if (data.success) setIsFavourite(!isFavourite);
  };

  const isManager = !!(user && (user.role === 'ADMIN' || (exhibitor && exhibitor.allowedUserIds.includes(user.id))));

  // Handle Image Conversion to Base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Image is too large. Please select an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProductFormData(prev => ({ ...prev, imageUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Product management actions
  const handleOpenProductForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        title: product.title,
        description: product.description,
        details: product.details,
        imageUrl: product.imageUrl || '',
      });
      // Filter conversions for this product
      const productConvs = conversions
        .filter(c => c.productId === product.id)
        .map(c => ({ id: c.id, date: c.date, value: c.value }));
      setProductConversions(productConvs);
    } else {
      setEditingProduct(null);
      setProductFormData({ title: '', description: '', details: '', imageUrl: '' });
      setProductConversions([]);
    }
    setShowProductForm(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = '/api/exhibitor/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.id, ...productFormData, conversions: productConversions }
        : { exhibitorId: id, ...productFormData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        await refreshExhibitorData();
        setShowProductForm(false);
      } else {
        alert(data.error || 'Failed to save product');
      }
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddConversionRow = () => {
    setProductConversions(prev => [...prev, { date: new Date().toISOString().split('T')[0], value: 0 }]);
  };

  const handleUpdateConversionRow = (idx: number, field: 'date' | 'value', val: string | number) => {
    setProductConversions(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        [field]: field === 'value' ? Number(val) : val,
      };
    }));
  };

  const handleRemoveConversionRow = (idx: number) => {
    setProductConversions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBack = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromAdmin = searchParams.get('fromAdmin') === 'true';
    if (fromAdmin) {
      router.push(`/admin?section=exhibitors&exhibitionId=${exhibitor?.exhibitionId || ''}`);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!exhibitor) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text">Exhibitor not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="detail-nav">
        <button onClick={handleBack} className="back-btn" aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <button onClick={toggleFavourite} className={`star-btn ${isFavourite ? 'active' : ''}`} aria-label="Toggle favourite">
          ⭐
        </button>
      </div>

      {/* Exhibitor Info */}
      <div className="exhibitor-hero card animate-scale-in">
        {exhibitor.imageUrl ? (
          <img
            src={exhibitor.imageUrl}
            alt={exhibitor.name}
            className="exhibitor-hero-avatar"
            style={{ objectFit: 'cover', border: '1px solid var(--color-border)' }}
          />
        ) : (
          <div className="exhibitor-hero-avatar">
            {exhibitor.name.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="exhibitor-hero-name">
          {exhibitor.name} {exhibitor.hasTrophy && exhibitor.hasTrophy !== 'none' && <span title="Featured Exhibitor" style={{ marginLeft: 4 }}>{getTrophyEmoji(exhibitor.hasTrophy)}</span>}
        </h1>
        <span className="badge badge-green" style={{ marginBottom: 'var(--space-3)' }}>
          Booth {exhibitor.boothNumber}
        </span>
        <p className="exhibitor-hero-desc">{exhibitor.description}</p>
        {exhibitor.details && (
          <div className="exhibitor-details">
            <p>{exhibitor.details}</p>
          </div>
        )}
      </div>

      {/* Products Heading */}
      {!isManager ? (
        <h3 className="section-title" style={{ marginTop: 'var(--space-6)' }}>Products</h3>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Products</h3>
          <button className="btn btn-primary" onClick={() => handleOpenProductForm()} style={{ fontSize: 'var(--font-size-sm)', padding: '6px 12px' }}>
            + Add Product
          </button>
        </div>
      )}

      <div className="search-wrapper" style={{ marginBottom: 'var(--space-4)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="products-search"
        />
      </div>

      {products.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
          <p className="empty-state-text">{search ? 'No products match your search' : 'No products listed'}</p>
        </div>
      ) : (
        <div className="products-list">
          {products.map((product, idx) => (
            <div key={product.id} className={`product-card card animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
              <div className="product-content-wrapper">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="product-image"
                  />
                )}
                <div className="product-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 className="product-title" style={{ margin: 0 }}>{product.title}</h4>
                    {isManager && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleOpenProductForm(product)} 
                        style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                  <p className="product-desc" style={{ marginTop: '4px' }}>{product.description}</p>
                  {product.details && <p className="product-details">{product.details}</p>}
                  
                  {/* Daily Purchase Conversions for Managers */}
                  {isManager && conversions.filter(c => c.productId === product.id).length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Daily Conversions:</span>
                      {conversions.filter(c => c.productId === product.id).map(c => (
                        <span key={c.id} className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {c.date}: {c.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Form Modal */}
      {showProductForm && (
        <>
          <div className="modal-overlay" onClick={() => setShowProductForm(false)} />
          <div className="modal-content">
            <div className="modal-handle" />
            <form onSubmit={handleSaveProduct} className="admin-form animate-scale-in" style={{ marginTop: 0, maxHeight: '80vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{editingProduct ? 'Edit' : 'Add'} Product</h3>
              
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input
                  className="form-input"
                  value={productFormData.title}
                  onChange={e => setProductFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="e.g., Collaborating Robot RX-7"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                  id="product-image-upload-detail"
                />
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label htmlFor="product-image-upload-detail" className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Choose File
                  </label>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Max 1MB</span>
                  {productFormData.imageUrl && (
                    <img 
                      src={productFormData.imageUrl} 
                      alt="Preview" 
                      style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--color-border)' }} 
                    />
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Description</label>
                <textarea
                  className="form-textarea"
                  value={productFormData.description}
                  onChange={e => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Short summary of the product..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Information</label>
                <textarea
                  className="form-textarea"
                  value={productFormData.details}
                  onChange={e => setProductFormData(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Product features, specifications, etc..."
                  rows={4}
                />
              </div>

              {editingProduct && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Daily Purchase Conversions</h4>
                    <button type="button" className="btn btn-secondary" onClick={handleAddConversionRow} style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}>
                      + Add Conversion Value
                    </button>
                  </div>

                  {productConversions.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                      No conversion statistics recorded yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {productConversions.map((conv, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="date"
                            className="form-input"
                            value={conv.date}
                            onChange={e => handleUpdateConversionRow(idx, 'date', e.target.value)}
                            style={{ flex: 2, padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                            required
                          />
                          <input
                            type="number"
                            className="form-input"
                            value={conv.value}
                            onChange={e => handleUpdateConversionRow(idx, 'value', e.target.value)}
                            placeholder="Value (e.g. 150)"
                            style={{ flex: 1, padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                            required
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRemoveConversionRow(idx)}
                            style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', border: 'none' }}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductForm(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .detail-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }
        .back-btn {
          padding: var(--space-2);
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
        }
        .back-btn:hover {
          background: var(--color-bg-glass);
          color: var(--color-text-primary);
        }
        .exhibitor-hero {
          text-align: center;
          padding: var(--space-6) !important;
        }
        .exhibitor-hero-avatar {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-xl);
          background: var(--gradient-cool);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-3xl);
          font-weight: 800;
          color: white;
          margin: 0 auto var(--space-4);
        }
        .exhibitor-hero-name {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          margin-bottom: var(--space-2);
        }
        .exhibitor-hero-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.6;
          margin-bottom: var(--space-3);
        }
        .exhibitor-details {
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.6;
          text-align: left;
        }
        .products-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .product-card {
          padding: var(--space-4) !important;
        }
        .product-content-wrapper {
          display: flex;
          gap: var(--space-4);
          align-items: flex-start;
        }
        .product-image {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-md);
          object-fit: cover;
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .product-info {
          flex: 1;
          min-width: 0;
        }
        .product-title {
          font-size: var(--font-size-base);
          font-weight: 600;
          margin-bottom: var(--space-2);
        }
        .product-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
        }
        .product-details {
          color: var(--color-text-tertiary);
          font-size: var(--font-size-xs);
          margin-top: var(--space-2);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
