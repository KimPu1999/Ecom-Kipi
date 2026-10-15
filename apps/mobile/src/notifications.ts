import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { commerceApi } from './commerce'

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }) })

export async function registerPushNotifications() {
  if (!Device.isDevice) return null
  const current = await Notifications.getPermissionsAsync()
  let status = current.status
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return null
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data
  await commerceApi.registerPushToken(token, Platform.OS)
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('orders', { name: 'Order updates', importance: Notifications.AndroidImportance.DEFAULT })
  return token
}
