import { ArrowRight, CheckCircle2, Cpu, Eye, EyeOff, Gamepad2, Laptop, LockKeyhole, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { loginSchema, registerSchema, emailSchema, type LoginInput, type RegisterInput } from '@kipi/validation'
import { ApiClientError } from '@kipi/api-client'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="field auth-field"><span>{label}</span><div className="field-control"><input {...props} /></div>{error ? <small className="error">{error}</small> : null}</label>
}

function PasswordField({ label, error, show, onToggle, ...props }: { label: string; error?: string; show: boolean; onToggle: () => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <label className="field auth-field"><span>{label}</span><div className="auth-password-control"><input type={show ? 'text' : 'password'} {...props} /><button type="button" className="auth-password-toggle" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error ? <small className="error">{error}</small> : null}</label>
}

function message(error: unknown) {
  return error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.'
}

type AuthMode = 'login' | 'register' | 'recovery'

function AuthBrand() {
  return <Link className="auth-brand-lockup" to="/" aria-label="THANGPC home"><Logo className="auth-brand-logo" /><span><strong>THANGPC</strong><small>PC &amp; electronics marketplace</small></span></Link>
}

function AuthShowcase({ mode }: { mode: AuthMode }) {
  const copy = {
    login: {
      title: 'Build your next setup.',
      description: 'From powerful components to everyday electronics, find the hardware that moves you forward.',
    },
    register: {
      title: 'Your setup starts here.',
      description: 'Save your favorites, discover trusted sellers, and make every upgrade feel effortless.',
    },
    recovery: {
      title: 'Back to your best setup.',
      description: 'Recover your account securely and get back to the hardware you love.',
    },
  }[mode]

  return <aside className={`auth-showcase auth-showcase-${mode}`} aria-label="THANGPC marketplace highlights"><div className="auth-showcase-top"><span className="auth-showcase-badge"><Sparkles size={15} /> THANGPC marketplace</span><span className="auth-showcase-status"><span /> Secure</span></div><div className="auth-showcase-copy"><span className="eyebrow">PC HARDWARE · ELECTRONICS</span><h2>{copy.title}</h2><p>{copy.description}</p></div><div className="auth-tech-stage" aria-hidden="true"><div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" /><div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" /><div className="auth-device auth-monitor"><div className="auth-monitor-screen"><div className="auth-screen-bar"><span /><span /><span /></div><div className="auth-screen-content"><Cpu size={30} /><strong>THANGPC</strong><small>Power your setup</small><div className="auth-screen-line" /></div></div><div className="auth-monitor-stand" /></div><div className="auth-device auth-laptop"><div className="auth-laptop-screen"><Laptop size={31} /><span>Ready when you are</span></div><div className="auth-laptop-base" /></div><div className="auth-floating-chip auth-chip-blue"><Gamepad2 size={18} /><span>Gaming ready</span></div><div className="auth-floating-chip auth-chip-purple"><Zap size={18} /><span>Fast &amp; capable</span></div><div className="auth-particle auth-particle-one" /><div className="auth-particle auth-particle-two" /><div className="auth-particle auth-particle-three" /></div><div className="auth-showcase-points"><span><CheckCircle2 size={16} /> Verified sellers</span><span><CheckCircle2 size={16} /> Secure checkout</span><span><CheckCircle2 size={16} /> Order tracking</span></div></aside>
}

function AuthFrame({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  return <section className="auth-page"><div className={`auth-shell auth-shell-${mode}`}><AuthShowcase mode={mode} /><section className="auth-card">{children}</section></div></section>
}

export function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setSession = useAuthStore((state) => state.setSession)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setServerError('')
    try {
      const response = await api.auth.login(values)
      setSession(response.data.user, response.data.token)
      navigate(params.get('next') || '/account', { replace: true })
    } catch (error) {
      setServerError(message(error))
    }
  }

  return <AuthFrame mode="login"><AuthBrand /><div className="auth-card-heading"><span className="auth-kicker">Welcome back to THANGPC</span><h1>Welcome Back</h1><p>Sign in to explore the latest PC hardware and electronics.</p></div>{serverError ? <div className="auth-error" role="alert">{serverError}</div> : null}<form className="auth-form" onSubmit={handleSubmit(onSubmit)}><Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} error={errors.email?.message} /><PasswordField label="Password" autoComplete="current-password" placeholder="Enter your password" show={showPassword} onToggle={() => setShowPassword((value) => !value)} {...register('password')} error={errors.password?.message} /><div className="auth-form-options"><label className="auth-checkbox"><input type="checkbox" /> <span>Remember me</span></label><Link to="/forgot-password">Forgot password?</Link></div><button className="button primary full auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign In'}<ArrowRight size={18} /></button></form><p className="auth-switch">New to THANGPC? <Link to="/register">Create your account</Link></p><p className="auth-security"><ShieldCheck size={16} /> Secure sign-in powered by THANGPC</p></AuthFrame>
}

export function Register() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterInput) {
    setServerError('')
    try {
      const response = await api.auth.register(values)
      setSession(response.data.user, response.data.token)
      navigate('/account', { replace: true })
    } catch (error) {
      setServerError(message(error))
    }
  }

  return <AuthFrame mode="register"><AuthBrand /><div className="auth-card-heading"><span className="auth-kicker">Join the THANGPC community</span><h1>Create Your THANGPC Account</h1><p>Create an account to shop smarter, save favorites, and track every order.</p></div>{serverError ? <div className="auth-error" role="alert">{serverError}</div> : null}<form className="auth-form auth-form-register" onSubmit={handleSubmit(onSubmit)}><Field label="Full name" autoComplete="name" placeholder="Your full name" {...register('name')} error={errors.name?.message} /><Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} error={errors.email?.message} /><Field label="Phone (optional)" autoComplete="tel" placeholder="Your phone number" {...register('phone')} error={errors.phone?.message} /><PasswordField label="Password" autoComplete="new-password" placeholder="At least 8 characters" show={showPassword} onToggle={() => setShowPassword((value) => !value)} {...register('password')} error={errors.password?.message} /><PasswordField label="Confirm password" autoComplete="new-password" placeholder="Re-enter your password" show={showConfirmation} onToggle={() => setShowConfirmation((value) => !value)} {...register('password_confirmation')} error={errors.password_confirmation?.message} /><button className="button primary full auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create Account'}<ArrowRight size={18} /></button></form><p className="auth-legal">By creating an account, you agree to the THANGPC marketplace terms and privacy practices.</p><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></AuthFrame>
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailSchema })) })

  async function onSubmit(values: { email: string }) {
    setServerError('')
    try {
      await api.auth.forgotPassword(values)
      setSent(true)
    } catch (error) {
      setServerError(message(error))
      setSent(true)
    }
  }

  return <AuthFrame mode="recovery"><AuthBrand /><div className="auth-card-heading"><span className="auth-kicker">Account recovery</span><h1>Reset Your Password</h1>{sent ? <p>Check your inbox for the next step.</p> : <p>Enter your email and we’ll help you get back to your THANGPC account.</p>}</div>{sent ? <div className="auth-success" role="status">If an account matches that email, we’ll send reset instructions shortly.</div> : <><div className="auth-recovery-note"><LockKeyhole size={17} /> Your account security stays protected throughout recovery.</div>{serverError ? <div className="auth-error" role="alert">{serverError}</div> : null}<form className="auth-form" onSubmit={handleSubmit(onSubmit)}><Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} error={errors.email?.message} /><button className="button primary full auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send Reset Link'}<ArrowRight size={18} /></button></form></>}<p className="auth-switch"><Link to="/login">Back to sign in</Link></p></AuthFrame>
}
