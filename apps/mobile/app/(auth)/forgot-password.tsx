import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { z } from 'zod'
import { Button, Heading, Input, Screen } from '../../src/components'
import { api } from '../../src/api'
import { colors } from '../../src/theme'

const schema = z.object({ email: z.string().email('Enter a valid email') })
export default function ForgotPassword() { const [message, setMessage] = useState(''); const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } }); async function submit(data: { email: string }) { try { await api.auth.forgotPassword(data); setMessage('If that account exists, a reset link is on its way.') } catch { setMessage('We could not send the reset link right now.') } } return <Screen><Heading eyebrow="Account help" title="Forgot password?" subtitle="Enter your email and we will send reset instructions." /><Controller control={control} name="email" render={({ field }) => <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} />{message ? <Text style={{ color: colors.primary, marginBottom: 8 }}>{message}</Text> : null}<Button title={isSubmitting ? 'Sending…' : 'Send reset link'} onPress={handleSubmit(submit)} disabled={isSubmitting} /><Link href="/(auth)/login" style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>Back to sign in</Link></Screen> }
