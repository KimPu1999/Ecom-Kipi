import { Stack } from 'expo-router'
import { AppProviders } from '../src/providers'
import { colors } from '../src/theme'

export default function Layout() {
  return <AppProviders><Stack screenOptions={{ headerTintColor: colors.ink, headerTitle: 'Kipi Commerce', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }} /></AppProviders>
}
