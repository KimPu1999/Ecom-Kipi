import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { loginSchema, registerSchema, emailSchema, type LoginInput, type RegisterInput } from '@kipi/validation'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { ApiClientError } from '@kipi/api-client'

function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="field"><span>{label}</span><div className="field-control"><input {...props} />{props.type === 'password' ? null : null}</div>{error ? <small className="error">{error}</small> : null}</label>
}

function message(error: unknown) {
  return error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.'
}

export function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setSession = useAuthStore((state) => state.setSession)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  async function onSubmit(values: LoginInput) { setServerError(''); try { const response = await api.auth.login(values); setSession(response.data.user, response.data.token); navigate(params.get('next') || '/account', { replace: true }) } catch (error) { setServerError(message(error)) } }
  return <section className="auth-layout"><div className="auth-aside"><span className="eyebrow">Kipi Commerce</span><h1>A calmer way to shop.</h1><p>Save your favorites, track orders, and make everyday essentials feel a little more considered.</p><span className="auth-note"><LockKeyhole size={16} />Secure account access</span></div><section className="form-card"><p className="eyebrow">Welcome back</p><h2>Sign in</h2><p className="form-subtitle">Pick up where you left off.</p>{serverError ? <div className="error-box" role="alert">{serverError}</div> : null}<form onSubmit={handleSubmit(onSubmit)}><Field label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} /><label className="field"><span>Password</span><div className="password-control"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} /><button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password ? <small className="error">{errors.password.message}</small> : null}</label><label className="checkbox"><input type="checkbox" /> Remember me</label><button className="button primary full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button></form><div className="auth-links"><Link to="/forgot-password">Forgot your password?</Link><span>New here? <Link to="/register">Create an account</Link></span></div></section></section>
}

export function Register() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })
  async function onSubmit(values: RegisterInput) { setServerError(''); try { const response = await api.auth.register(values); setSession(response.data.user, response.data.token); navigate('/account', { replace: true }) } catch (error) { setServerError(message(error)) } }
  return <section className="narrow-page"><section className="form-card"><p className="eyebrow">Join Kipi</p><h1>Create account</h1><p className="form-subtitle">A more useful shopping experience starts here.</p>{serverError ? <div className="error-box" role="alert">{serverError}</div> : null}<form onSubmit={handleSubmit(onSubmit)}><Field label="Full name" autoComplete="name" {...register('name')} error={errors.name?.message} /><Field label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} /><Field label="Phone (optional)" autoComplete="tel" {...register('phone')} error={errors.phone?.message} /><Field label="Password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} /><Field label="Confirm password" type="password" autoComplete="new-password" {...register('password_confirmation')} error={errors.password_confirmation?.message} /><button className="button primary full" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button></form><p className="form-note">Already registered? <Link to="/login">Sign in</Link></p></section></section>
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailSchema })) })
  async function onSubmit(values: { email: string }) { setServerError(''); try { await api.auth.forgotPassword(values); setSent(true) } catch (error) { setServerError(message(error)); setSent(true) } }
  return <section className="narrow-page"><section className="form-card"><p className="eyebrow">Account recovery</p><h1>Reset your password.</h1>{sent ? <div className="success-box" role="status">If an account matches that email, we’ll send reset instructions shortly.</div> : <><p className="form-subtitle">Enter your email and we’ll help you get back in.</p>{serverError ? <div className="error-box">{serverError}</div> : null}<form onSubmit={handleSubmit(onSubmit)}><Field label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} /><button className="button primary full" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'}</button></form></>}<p className="form-note"><Link to="/login">Back to sign in</Link></p></section></section>
}
