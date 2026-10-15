import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { FlatList, Pressable, Text } from 'react-native'
import { commerceApi } from '../../src/commerce'
import { EmptyState, ErrorState, Heading, LoadingState, Screen, styles } from '../../src/components'
import { colors } from '../../src/theme'

export default function Categories() { const query = useQuery({ queryKey: ['mobile-categories'], queryFn: commerceApi.categories }); if (query.isLoading) return <LoadingState />; if (query.isError) return <ErrorState onRetry={() => query.refetch()} />; return <Screen><Heading eyebrow="Explore" title="Categories" subtitle="Find something that fits your everyday." />{query.data?.data.length ? <FlatList data={query.data.data} keyExtractor={(item) => String(item.id)} numColumns={2} columnWrapperStyle={{ justifyContent: 'space-between' }} renderItem={({ item }) => <Pressable style={({ pressed }) => [styles.card, { width: '48%', minHeight: 120, justifyContent: 'flex-end' }, pressed && styles.pressed]} onPress={() => router.push(('/search?category=' + item.slug) as never)}><Text style={{ color: colors.primary, fontWeight: '800' }}>0{item.id}</Text><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{item.name}</Text></Pressable>} /> : <EmptyState title="No categories yet" message="Check back for the next collection." />}</Screen> }
