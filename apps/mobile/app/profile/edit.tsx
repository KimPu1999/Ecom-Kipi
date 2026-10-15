import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { router } from 'expo-router'
import { Text } from 'react-native'
import { z } from 'zod'
import { Button, Heading, Input, LoadingState, Screen } from '../../src/components'
import { commerceApi } from '../../src/commerce'
import { colors } from '../../src/theme'

const schema = z.object({ name: z.string().min(2, 'Enter your name'), phone: z.string().optional() })
type Form = z.infer<typeof schema>
export default function ProfileEdit() { const client = useQueryClient(); const query = useQuery({ queryKey: ['mobile-profile'], queryFn: commerceApi.profile }); const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), values: { name: query.data?.data.name ?? '', phone: query.data?.data.phone ?? '' } }); const save = useMutation({ mutationFn: commerceApi.updateProfile, onSuccess: () => { client.invalidateQueries({ queryKey: ['mobile-profile'] }); router.back() } }); if (query.isLoading) return <LoadingState />; return <Screen><Heading eyebrow="Account" title="Edit profile" /><Controller control={control} name="name" render={({ field }) => <Input label="Full name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} />} /><Controller control={control} name="phone" render={({ field }) => <Input label="Phone" keyboardType="phone-pad" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.phone?.message} />} /><Button title={isSubmitting || save.isPending ? 'Saving…' : 'Save changes'} onPress={handleSubmit((data) => save.mutate(data))} disabled={isSubmitting || save.isPending} />{save.isError ? <Text style={{ color: colors.danger, marginTop: 8 }}>We could not update your profile.</Text> : null}</Screen> }
