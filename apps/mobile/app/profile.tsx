import { router } from 'expo-router'
import { Button, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useMobileAuth } from '../src/auth'

export default function Profile() {
  const { user, clear } = useMobileAuth()
  async function signOut() { clear(); await SecureStore.deleteItemAsync('kipi.auth.token'); router.replace('/') }
  return <View style={styles.container}><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.title}>{user?.name ?? 'Your profile'}</Text><Text style={styles.body}>{user?.email ?? 'Sign in to see your account.'}</Text><Button title="Sign out" color="#315C49" onPress={signOut} /></View>
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 28, paddingTop: 100, backgroundColor: '#F7F4ED' }, eyebrow: { color: '#315C49', fontWeight: '800', letterSpacing: 2 }, title: { color: '#16251F', fontSize: 40, fontWeight: '800', marginVertical: 14 }, body: { color: '#6B756F', fontSize: 17, marginBottom: 28 } })
