import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storefrontApi } from '../services/storefrontApi';
import type { Address } from '../types/storefront';
import {
    Card,
    EmptyState,
    ErrorState,
    LoadingState,
    PageIntro,
    StatusBadge,
} from '../components/StorefrontUI';

const manualPaymentCodes = ['kbzpay', 'ayapay', 'wavepay', 'bank_transfer'] as const;
type CheckoutPaymentMethod = 'cod' | (typeof manualPaymentCodes)[number];

export function CheckoutPage() {
    const client = useQueryClient();
    const navigate = useNavigate();
    const addresses = useQuery({ queryKey: ['addresses'], queryFn: storefrontApi.addresses });
    const cart = useQuery({ queryKey: ['cart'], queryFn: storefrontApi.cart });
    const shipping = useQuery({
        queryKey: ['shipping-methods'],
        queryFn: storefrontApi.shippingMethods,
    });
    const manualMethods = useQuery({
        queryKey: ['manual-payment-methods'],
        queryFn: storefrontApi.manualPaymentMethods,
    });
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [methodId, setMethodId] = useState<number | null>(null);
    const [couponInput, setCouponInput] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const selected = addresses.data?.data.find(
        (address) =>
            address.id === (selectedId ?? addresses.data.data.find((item) => item.is_default)?.id),
    );
    const method = shipping.data?.data.find(
        (item) => item.id === (methodId ?? shipping.data.data[0]?.id),
    );
    const preview = useQuery({
        queryKey: ['checkout-preview', method?.id, couponCode],
        queryFn: () => storefrontApi.checkoutPreview(method?.id, couponCode || undefined),
        enabled: Boolean(cart.data?.data.item_count && method?.id),
    });
    const [paymentError, setPaymentError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('cod');
    const [senderPhone, setSenderPhone] = useState('');
    const [transactionCode, setTransactionCode] = useState('');
    const isManualPayment = manualPaymentCodes.includes(
        paymentMethod as (typeof manualPaymentCodes)[number],
    );
    const selectedManualMethod = manualMethods.data?.data.find((item) => item.code === paymentMethod);
    const confirm = useMutation({
        mutationFn: () =>
            storefrontApi.confirmCheckout(
                {
                    shipping_address: selected,
                    billing_address: selected,
                    shipping_method_id: method?.id,
                    coupon_code: couponCode || undefined,
                    payment_method: paymentMethod,
                    ...(isManualPayment
                        ? {
                              payment_metadata: {
                                  sender_phone: senderPhone.trim(),
                                  transaction_code: transactionCode.trim(),
                              },
                          }
                        : {}),
                },
                crypto.randomUUID(),
            ),
        onSuccess: (response) => {
            client.invalidateQueries({ queryKey: ['cart'] });
            navigate('/account/orders/' + response.data.id);
        },
    });
    if (
        addresses.isLoading ||
        cart.isLoading ||
        shipping.isLoading ||
        (cart.data?.data.item_count && preview.isLoading) ||
        manualMethods.isLoading
    )
        return <LoadingState />;
    if (addresses.isError || cart.isError || shipping.isError)
        return (
            <ErrorState message="We could not prepare checkout. Please review your cart and try again." />
        );
    if (preview.isError) {
        const previewError = (preview as { error?: unknown }).error;
        return (
            <div className="narrow-page">
                <ErrorState
                    message={
                        previewError instanceof Error
                            ? previewError.message
                            : 'We could not calculate the checkout total. Please refresh and try again.'
                    }
                />
            </div>
        );
    }
    if (!cart.data?.data.item_count)
        return (
            <div className="narrow-page">
                <EmptyState
                    title="Nothing to check out"
                    message="Add something to your cart before continuing."
                    action={
                        <Link className="button primary" to="/products">
                            Browse products
                        </Link>
                    }
                />
            </div>
        );
    if (!addresses.data?.data.length)
        return (
            <div className="narrow-page">
                <EmptyState
                    title="Add a delivery address"
                    message="We need a shipping address before we can prepare this order."
                    action={
                        <Link className="button primary" to="/account/addresses">
                            Manage addresses
                        </Link>
                    }
                />
            </div>
        );
    return (
        <div className="checkout-page">
            <PageIntro
                eyebrow="Checkout"
                title="Almost yours."
                description="Totals and availability are recalculated by Laravel before confirmation."
            />
            <div className="checkout-progress" aria-label="Checkout progress">
                <span className="active">
                    <b>1</b> Review
                </span>
                <span>
                    <b>2</b> Delivery
                </span>
                <span>
                    <b>3</b> Payment
                </span>
            </div>
            <div className="checkout-trust">
                <strong>Secure checkout</strong>
                <span>
                    Choose cash on delivery or a manual online transfer. Kipi does not store card details.
                </span>
            </div>
            <div className="checkout-layout">
                <div className="checkout-main">
                    <Card>
                        <div className="card-heading">
                            <h2>Delivery address</h2>
                            <Link className="text-link" to="/account/addresses">
                                Manage
                            </Link>
                        </div>
                        <div className="address-select-list">
                            {addresses.data.data.map((address) => (
                                <AddressChoice
                                    address={address}
                                    selected={selected?.id === address.id}
                                    onClick={() => setSelectedId(address.id)}
                                    key={address.id}
                                />
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <div className="card-heading">
                            <h2>Shipping method</h2>
                        </div>
                        <div className="address-select-list">
                            {shipping.data?.data.map((item) => (
                                <button
                                    type="button"
                                    className={
                                        method?.id === item.id
                                            ? 'address-select selected'
                                            : 'address-select'
                                    }
                                    key={item.id}
                                    onClick={() => setMethodId(item.id)}
                                >
                                    <span className="radio-dot" />
                                    <div>
                                        <strong>{item.name}</strong>
                                        <p>{item.description || 'Reliable delivery'}</p>
                                    </div>
                                    <b>
                                        {item.price_minor.toLocaleString()} {item.currency}
                                    </b>
                                </button>
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <div className="card-heading">
                            <h2>Payment method</h2>
                        </div>
                        <div className="address-select-list">
                            <button
                                type="button"
                                className={
                                    paymentMethod === 'cod'
                                        ? 'address-select selected'
                                        : 'address-select'
                                }
                                onClick={() => {
                                    setPaymentMethod('cod');
                                    setPaymentError('');
                                }}
                            >
                                <span className="radio-dot" />
                                <div>
                                    <strong>Cash on delivery</strong>
                                    <p>Pay the authorized delivery team when your order arrives.</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                className={
                                    isManualPayment && !manualMethods.isError && manualMethods.data?.data.length
                                        ? 'address-select selected'
                                        : 'address-select'
                                }
                                onClick={() => {
                                    setPaymentMethod((manualMethods.data?.data[0]?.code ?? 'kbzpay') as CheckoutPaymentMethod);
                                    setPaymentError('');
                                }}
                                disabled={manualMethods.isError || !manualMethods.data?.data.length}
                            >
                                <span className="radio-dot" />
                                <div>
                                    <strong>Online payment</strong>
                                    <p>
                                        KBZPay, AYA Pay, WavePay, or bank transfer. Payment stays
                                        pending until Admin verifies it.
                                    </p>
                                </div>
                            </button>
                        </div>
                        {manualMethods.isError ? <p className="error" role="alert">Online payment methods are unavailable. Please use another payment method or try again later.</p> : null}
                        {isManualPayment ? (
                            <div className="stack-form mt-3">
                                {selectedManualMethod ? <div className="manual-payment-recipient"><div><span>Send payment to</span><strong>{selectedManualMethod.recipient_name}</strong><small>{selectedManualMethod.recipient_phone} · {selectedManualMethod.label}</small></div>{selectedManualMethod.qr_url ? <img src={selectedManualMethod.qr_url} alt={`${selectedManualMethod.label} payment QR code`} /> : null}</div> : null}
                                <label className="field">
                                    <span>Online payment provider</span>
                                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CheckoutPaymentMethod)}>
                                        {manualMethods.data?.data.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}
                                    </select>
                                </label>
                                <label className="field">
                                    <span>Phone number used for payment</span>
                                    <input
                                        required
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={senderPhone}
                                        onChange={(event) => setSenderPhone(event.target.value)}
                                        placeholder="09xxxxxxxxx"
                                    />
                                </label>
                                <label className="field">
                                    <span>Transaction / payment code</span>
                                    <input
                                        required
                                        value={transactionCode}
                                        onChange={(event) => setTransactionCode(event.target.value)}
                                        placeholder="Enter the code from your payment receipt"
                                    />
                                </label>
                                <p className="muted">
                                    Enter the details from your real payment receipt. An authorized
                                    Admin must verify the transfer before the order becomes paid.
                                </p>
                            </div>
                        ) : null}
                    </Card>
                    <Card>
                        <div className="card-heading">
                            <h2>Promotion code</h2>
                            <span className="muted">Optional</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={couponInput}
                                onChange={(event) =>
                                    setCouponInput(event.target.value.toUpperCase())
                                }
                                placeholder="Enter coupon code"
                                aria-label="Coupon code"
                            />
                            <button
                                className="button secondary"
                                type="button"
                                onClick={() => setCouponCode(couponInput.trim())}
                            >
                                Apply
                            </button>
                        </div>
                        {couponCode && preview.data?.data.coupon_code ? (
                            <p className="success-box mt-3">
                                Coupon {preview.data.data.coupon_code} applied.
                            </p>
                        ) : null}
                    </Card>
                    {paymentMethod === 'cod' ? (
                        <Card>
                            <div className="card-heading">
                                <h2>Cash on delivery</h2>
                                <StatusBadge value="payment pending" />
                            </div>
                            <p className="muted">
                                Your order can enter fulfillment, but payment becomes Paid only
                                after an authorized confirmation that cash was received.
                            </p>
                        </Card>
                    ) : (
                        <Card>
                            <div className="card-heading">
                                <h2>Online payment submitted for review</h2>
                                <StatusBadge value="payment pending" />
                            </div>
                            <p className="muted">
                                Your phone number and transaction code are saved with the order for
                                authorized verification. The order is not marked paid automatically.
                            </p>
                        </Card>
                    )}
                </div>
                <Card className="checkout-summary">
                    <span className="eyebrow">Order summary</span>
                    <h2>{cart.data.data.item_count} items</h2>
                    <div className="checkout-items">
                        {cart.data.data.items.map((item) => (
                            <div className="checkout-item" key={item.id}>
                                <div>
                                    <strong>{item.variant.product.name}</strong>
                                    <small>
                                        {item.variant.attributes
                                            ? Object.entries(item.variant.attributes)
                                                  .map(([key, value]) => `${key}: ${value}`)
                                                  .join(' · ')
                                            : item.variant.sku}{' '}
                                        · Qty {item.quantity}
                                    </small>
                                </div>
                                <b>
                                    {item.line_total_minor.toLocaleString()} {item.variant.currency}
                                </b>
                            </div>
                        ))}
                    </div>
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <strong>
                            {preview.data?.data.subtotal_minor.toLocaleString()}{' '}
                            {preview.data?.data.currency}
                        </strong>
                    </div>
                    <div className="summary-row">
                        <span>Discount</span>
                        <span>
                            -{preview.data?.data.discount_minor.toLocaleString()}{' '}
                            {preview.data?.data.currency}
                        </span>
                    </div>
                    <div className="summary-row">
                        <span>Shipping</span>
                        <span>
                            {preview.data?.data.shipping_minor.toLocaleString()}{' '}
                            {preview.data?.data.currency}
                        </span>
                    </div>
                    <div className="summary-row">
                        <span>Tax</span>
                        <span>
                            {preview.data?.data.tax_minor.toLocaleString()}{' '}
                            {preview.data?.data.currency}
                        </span>
                    </div>
                    <div className="summary-total">
                        <span>Total</span>
                        <strong>
                            {preview.data?.data.grand_total_minor.toLocaleString()}{' '}
                            {preview.data?.data.currency}
                        </strong>
                    </div>
                    <button
                        className="button primary full"
                        disabled={
                            !selected ||
                            !method ||
                            !preview.data ||
                            confirm.isPending ||
                            (isManualPayment && (!senderPhone.trim() || !transactionCode.trim()))
                        }
                        onClick={() => {
                            setPaymentError('');
                            if (window.confirm('Confirm this order?')) confirm.mutate();
                        }}
                    >
                        {confirm.isPending ? 'Confirming order…' : 'Confirm order'}
                    </button>
                    {confirm.isError ? (
                        <p className="error" role="alert">
                            Checkout could not be confirmed. Your cart was not charged.
                        </p>
                    ) : null}
                    {paymentError ? (
                        <p className="error" role="alert">
                            {paymentError}
                        </p>
                    ) : null}
                </Card>
            </div>
        </div>
    );
}

function AddressChoice({
    address,
    selected,
    onClick,
}: {
    address: Address;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            className={selected ? 'address-select selected' : 'address-select'}
            onClick={onClick}
        >
            <span className="radio-dot" />
            <div>
                <strong>{address.label || 'Delivery address'}</strong>
                {address.is_default ? <StatusBadge value="default" /> : null}
                <p>
                    {address.recipient_name}
                    <br />
                    {address.line1}, {address.city}, {address.country}
                </p>
            </div>
        </button>
    );
}
