import { sendPushNotification } from '@/lib/push'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}))

jest.mock('@/lib/push-store', () => ({
  getPushSubscription: jest.fn(),
}))

beforeEach(() => { jest.clearAllMocks() })

test('sendPushNotification does nothing when no subscription', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue(null)
  await sendPushNotification('Test', 'Message')
  const webpush = jest.requireMock('web-push')
  expect(webpush.sendNotification).not.toHaveBeenCalled()
})

test('sendPushNotification sends when subscription exists', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue({ endpoint: 'https://push.example.com', keys: {} })
  await sendPushNotification('주문 체결', 'AAPL 10주 매수 체결')
  const webpush = jest.requireMock('web-push')
  expect(webpush.sendNotification).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: 'https://push.example.com' }),
    JSON.stringify({ title: '주문 체결', body: 'AAPL 10주 매수 체결' })
  )
})

test('sendPushNotification swallows errors silently', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue({ endpoint: 'https://push.example.com' })
  const webpush = jest.requireMock('web-push')
  webpush.sendNotification.mockRejectedValueOnce(new Error('Gone'))
  await expect(sendPushNotification('T', 'B')).resolves.toBeUndefined()
})
