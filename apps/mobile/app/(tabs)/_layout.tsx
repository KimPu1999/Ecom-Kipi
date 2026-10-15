import { Tabs } from 'expo-router'
import { colors } from '../../src/theme'

export default function TabsLayout() {
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingBottom: 8 }, headerShown: false }}><Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <TextIcon value="⌂" /> }} /><Tabs.Screen name="categories" options={{ title: 'Categories', tabBarIcon: () => <TextIcon value="▦" /> }} /><Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: () => <TextIcon value="◫" /> }} /><Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TextIcon value="○" /> }} /></Tabs>
}

function TextIcon({ value }: { value: string }) { return <>{value}</> }
