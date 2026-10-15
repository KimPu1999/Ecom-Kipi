import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

export default function Home() {
  return <View style={styles.container}><Text style={styles.eyebrow}>HOME</Text><Text style={styles.title}>Good things are on the way.</Text><Text style={styles.body}>Product discovery and order history will connect to the catalog APIs in Phase 3.</Text><Link style={styles.button} href="/profile">View profile</Link></View>
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 28, paddingTop: 100, backgroundColor: '#F7F4ED' }, eyebrow: { color: '#315C49', fontWeight: '800', letterSpacing: 2 }, title: { color: '#16251F', fontSize: 40, lineHeight: 43, fontWeight: '800', marginVertical: 14 }, body: { color: '#6B756F', fontSize: 17, marginBottom: 28 }, button: { color: 'white', backgroundColor: '#315C49', textAlign: 'center', borderRadius: 24, padding: 14, overflow: 'hidden' } })
