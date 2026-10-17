import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { loginSchema, type LoginInput } from '@kipi/validation'
import { api } from '../lib/api'
import { useAdminAuth } from '../store/auth'
import { useLanguage } from '../store/language'
import logoUrl from '../../../../packages/brand/assets/kipi-logo.png'

export function Login() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const setSession = useAdminAuth((state) => state.setSession)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setServerError('')
    try {
      const response = await api.auth.login(values)
      const roles = response.data.user.roles ?? []
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        navigate('/admin/unauthorized')
        return
      }
      setSession(response.data.user, response.data.token)
      navigate('/admin')
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t('Unable to sign in. Check your credentials.'))
    }
  }

  return <div className="login-shell"><div className="login-art"><div className="login-orb" /><span className="eyebrow">{t('THANGPC CONTROL CENTER')}</span><h1>{t('Run the store with clarity.')}</h1><p>{t('Secure operations for catalog, inventory, orders, and customer care.')}</p><div className="login-points"><span><LockKeyhole size={16} />{t('Role-protected by Laravel')}</span><span>{t('Live metrics from your database')}</span></div></div><section className="login-card"><div className="admin-auth-brand"><img src={logoUrl} alt="THANGPC" /><span><strong>THANGPC</strong><small>{t('Control center')}</small></span></div><span className="eyebrow">{t('Administrator access')}</span><h2>{t('Welcome Back')}</h2><p className="login-subtitle">{t('Sign in to manage the THANGPC marketplace.')}</p>{serverError ? <div className="login-error" role="alert">{serverError}</div> : null}<form onSubmit={handleSubmit(onSubmit)}><label>{t('Email')}<input type="email" autoComplete="email" placeholder="admin@example.com" {...register('email')} />{errors.email ? <small>{errors.email.message}</small> : null}</label><label>{t('Password')}<div className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={t('Your password')} {...register('password')} /><button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('Hide password') : t('Show password')}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password ? <small>{errors.password.message}</small> : null}</label><label className="checkbox remember"><input type="checkbox" /> {t('Remember this device')}</label><button className="button primary login-button" disabled={isSubmitting}>{isSubmitting ? t('Signing in…') : t('Sign in to control center')}</button></form><p className="login-footnote">{t('Administrator access is logged and audited.')}</p></section></div>
}
