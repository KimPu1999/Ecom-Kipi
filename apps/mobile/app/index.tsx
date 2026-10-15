import { Link, router } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LoadingState } from '../src/components'
import { useMobileAuth } from '../src/auth'
import { colors } from '../src/theme'

export default function Welcome() {
  const { hydrated, user } = useMobileAuth()
  useEffect(() => { if (hydrated && user) router.replace('/(tabs)' as never) }, [hydrated, user])
  if (!hydrated || user) return <LoadingState />
  return <View style={styles.container}><Text style={styles.logo}>KIPI</Text><Text style={styles.eyebrow}>COMMERCE</Text><Text style={styles.title}>Everyday shopping, made calm.</Text><Text style={styles.body}>Thoughtfully selected goods, secure checkout, and simple delivery.</Text><Link style={styles.button} href="/(auth)/login">Sign in</Link><Link style={styles.link} href="/(auth)/register">Create an account</Link><Link style={styles.browse} href="/(tabs)">Browse as a guest</Link></View>
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.background }, logo: { color: colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 4 }, eyebrow: { color: colors.muted, fontWeight: '800', letterSpacing: 2, marginTop: 4 }, title: { color: colors.ink, fontSize: 42, lineHeight: 46, fontWeight: '800', marginVertical: 16 }, body: { color: colors.muted, fontSize: 17, lineHeight: 25, marginBottom: 24 }, button: { color: colors.white, backgroundColor: colors.primary, borderRadius: 12, padding: 15, textAlign: 'center', fontWeight: '800', overflow: 'hidden' }, link: { color: colors.primary, textAlign: 'center', padding: 16, fontWeight: '800' }, browse: { color: colors.muted, textAlign: 'center', padding: 12 } })
