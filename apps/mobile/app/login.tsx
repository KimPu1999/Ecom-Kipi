import { useState } from 'react'
import { Link, router } from 'expo-router'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, saveToken } from '../src/api'
import { useMobileAuth } from '../src/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const setSession = useMobileAuth((state) => state.setSession)
  async function submit() {
    try { const response = await api.auth.login({ email, password }); setSession(response.data.user, response.data.token); await saveToken(response.data.token); router.replace('/home') } catch { setError('Unable to sign in. Check your details and try again.') }
  }
  return <View style={styles.container}><Text style={styles.title}>Sign in</Text><TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} /><TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button title="Sign in" color="#315C49" onPress={submit} /><Link style={styles.link} href="/register">Create an account</Link></View>
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#F7F4ED' }, title: { color: '#16251F', fontSize: 38, fontWeight: '800', marginBottom: 24 }, input: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 14 }, error: { color: '#B42318', marginBottom: 14 }, link: { color: '#315C49', textAlign: 'center', padding: 16 } })
