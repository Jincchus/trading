import { useRef, useEffect } from 'react'
import { BackHandler, StyleSheet, SafeAreaView, Platform, ActivityIndicator, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

// 서버 주소 설정 (.env에서 EXPO_PUBLIC_APP_URL 로 변경 가능)
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'http://192.168.0.1:3000'

export default function App() {
  const webViewRef = useRef<WebViewType>(null)
  const canGoBackRef = useRef(false)

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const handler = () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack()
        return true
      }
      return false
    }
    BackHandler.addEventListener('hardwareBackPress', handler)
    return () => BackHandler.removeEventListener('hardwareBackPress', handler)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onNavigationStateChange={state => { canGoBackRef.current = state.canGoBack }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#ef4444" />
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  webview: {
    flex: 1,
    backgroundColor: '#030712',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
