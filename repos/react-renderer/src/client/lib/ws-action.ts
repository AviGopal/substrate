// ws-action.ts — thin module-level bridge so ImpulseViewport can send
// action messages without needing the WebSocket passed through props.
// App.tsx registers the send fn; components call sendAction().

type SendFn = (data: string) => void

let _send: SendFn | null = null

export function registerWsSend(fn: SendFn): void {
  _send = fn
}

export function sendAction(
  action: string,
  impulseId: string,
  payload?: Record<string, unknown>
): void {
  if (!_send) return
  _send(JSON.stringify({
    type: 'action',
    action,
    componentId: impulseId,
    payload: payload ?? {},
    timestamp: Date.now(),
  }))
}
