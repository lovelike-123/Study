/**
 * 浮层关闭栈：用于把"系统返回键"优先派发给当前最上层的弹窗 / Picker / Popup。
 * 组件在打开浮层时 push 一个关闭回调，关闭时（或组件卸载时）自动 pop。
 * 系统返回时由 BackButtonHandler 调用 consumeTopBackHandler() 关闭最上层浮层。
 */
type BackHandler = () => void

const stack: BackHandler[] = []

/** 注册一个返回处理回调，返回取消函数（在 effect cleanup 中调用） */
export function pushBackHandler(fn: BackHandler): () => void {
  stack.push(fn)
  return () => {
    const i = stack.indexOf(fn)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** 消费最上层的返回处理；如果有浮层被关闭返回 true */
export function consumeTopBackHandler(): boolean {
  const fn = stack.pop()
  if (!fn) return false
  try {
    fn()
  } catch {
    /* 忽略单个浮层关闭异常，避免阻断返回链 */
  }
  return true
}
