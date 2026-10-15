import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { z } from 'zod'
import { Button, Heading, Input, Screen } from '../../src/components'
import { api, saveToken } from '../../src/api'
import { useMobileAuth } from '../../src/auth'
import { colors } from '../../src/theme'

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') })
type Form = z.infer<typeof schema>

export default function Login() {
  const [serverError, setServerError] = useState('')
  const setSession = useMobileAuth((state) => state.setSession)
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  async function submit(data: Form) { setServerError(''); try { const response = await api.auth.login(data); setSession(response.data.user, response.data.token); await saveToken(response.data.token); router.replace('/(tabs)' as never) } catch { setServerError('Unable to sign in. Check your details and try again.') } }
  return <Screen scroll><Heading eyebrow="Welcome back" title="Sign in" subtitle="Your Kipi collection is waiting." /><Controller control={control} name="email" render={({ field }) => <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field }) => <Input label="Password" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} />{serverError ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{serverError}</Text> : null}<Button title={isSubmitting ? 'Signing in…' : 'Sign in'} onPress={handleSubmit(submit)} disabled={isSubmitting} /><Link href="/(auth)/forgot-password" style={{ color: colors.primary, textAlign: 'center', padding: 16 }}>Forgot password?</Link><Link href="/(auth)/register" style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>New here? Create an account</Link></Screen>
}
