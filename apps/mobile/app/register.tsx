import { useState } from 'react'
import { Link, router } from 'expo-router'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, saveToken } from '../src/api'
import { useMobileAuth } from '../src/auth'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const setSession = useMobileAuth((state) => state.setSession)
  async function submit() {
    try { const response = await api.auth.register(form); setSession(response.data.user, response.data.token); await saveToken(response.data.token); router.replace('/home') } catch { setError('Unable to create your account. Please review your details.') }
  }
  return <View style={styles.container}><Text style={styles.title}>Create account</Text>{[['name', 'Name'], ['email', 'Email'], ['password', 'Password'], ['password_confirmation', 'Confirm password']].map(([key, label]) => <TextInput key={key} style={styles.input} placeholder={label} secureTextEntry={key.includes('password')} autoCapitalize={key === 'email' ? 'none' : 'sentences'} value={form[key as keyof typeof form]} onChangeText={(value) => setForm({ ...form, [key]: value })} />)}{error ? <Text style={styles.error}>{error}</Text> : null}<Button title="Create account" color="#315C49" onPress={submit} /><Link style={styles.link} href="/login">Already registered? Sign in</Link></View>
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#F7F4ED' }, title: { color: '#16251F', fontSize: 38, fontWeight: '800', marginBottom: 24 }, input: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 12 }, error: { color: '#B42318', marginBottom: 14 }, link: { color: '#315C49', textAlign: 'center', padding: 16 } })
