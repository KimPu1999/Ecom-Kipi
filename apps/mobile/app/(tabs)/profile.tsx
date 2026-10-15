import * as SecureStore from 'expo-secure-store'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text } from 'react-native'
import { commerceApi } from '../../src/commerce'
import { api } from '../../src/api'
import { Button, Card, EmptyState, Heading, LoadingState, Screen, styles } from '../../src/components'
import { useMobileAuth } from '../../src/auth'
import { colors } from '../../src/theme'

export default function Profile() { const { user, clear } = useMobileAuth(); const query = useQuery({ queryKey: ['mobile-profile'], queryFn: commerceApi.profile, enabled: !!user }); async function signOut() { try { await commerceApi.removePushToken() } catch (error) { void error } try { await api.auth.logout() } catch (error) { void error } clear(); await SecureStore.deleteItemAsync('kipi.auth.token'); router.replace('/' as never) } if (!user) return <Screen><EmptyState title="Your account" message="Sign in to manage orders, addresses, and preferences." action={{ title: 'Sign in', onPress: () => router.push('/(auth)/login' as never) }} /></Screen>; if (query.isLoading) return <LoadingState />; const profile = query.data?.data ?? user; return <Screen scroll><Heading eyebrow="Account" title={profile.name} subtitle={profile.email} /><Card><Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>Your details</Text><Text style={styles.subtitle}>{profile.phone ?? 'Add a phone number for delivery updates.'}</Text><Button title="Edit profile" secondary onPress={() => router.push('/profile/edit' as never)} /></Card><Card><Text style={styles.link} onPress={() => router.push('/orders' as never)}>Orders →</Text><Text style={styles.link} onPress={() => router.push('/addresses' as never)}>Addresses →</Text><Text style={styles.link} onPress={() => router.push('/notifications' as never)}>Notification preferences →</Text></Card><Button title="Sign out" secondary onPress={signOut} /></Screen> }
