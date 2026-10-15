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

const schema = z.object({ name: z.string().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters'), password_confirmation: z.string() }).refine((data) => data.password === data.password_confirmation, { path: ['password_confirmation'], message: 'Passwords must match' })
type Form = z.infer<typeof schema>

export default function Register() {
  const [serverError, setServerError] = useState('')
  const setSession = useMobileAuth((state) => state.setSession)
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '', password_confirmation: '' } })
  async function submit(data: Form) { setServerError(''); try { const response = await api.auth.register(data); setSession(response.data.user, response.data.token); await saveToken(response.data.token); router.replace('/(tabs)' as never) } catch { setServerError('Unable to create your account. Please review your details.') } }
  return <Screen scroll><Heading eyebrow="Start here" title="Create account" subtitle="A calmer way to shop your everyday essentials." /><Controller control={control} name="name" render={({ field }) => <Input label="Full name" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} />} /><Controller control={control} name="email" render={({ field }) => <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field }) => <Input label="Password" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} /><Controller control={control} name="password_confirmation" render={({ field }) => <Input label="Confirm password" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password_confirmation?.message} />} />{serverError ? <Text style={{ color: colors.danger }}>{serverError}</Text> : null}<Button title={isSubmitting ? 'Creating…' : 'Create account'} onPress={handleSubmit(submit)} disabled={isSubmitting} /><Link href="/(auth)/login" style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>Already registered? Sign in</Link></Screen>
}
