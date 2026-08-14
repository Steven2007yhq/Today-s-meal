import { Component } from 'react'

// App.jsx renders as one ~1800-line tree, so a throw anywhere inside it unmounts
// the entire interface. main.jsx also removes the HTML loader on a timer, which
// means an unguarded crash leaves the user staring at an empty window with no
// message and no way back. AssistantErrorBoundary only covers the AI panel.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[app] 界面渲染失败：', error, errorInfo?.componentStack || '')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="app-crash">
        <div className="app-crash-card">
          <span aria-hidden="true">🥣</span>
          <h1>小饭把锅打翻了</h1>
          <p>界面遇到了一个没能处理好的错误。保存在本机的账号、收藏和餐食记录都还在，重新载入通常就能回到刚才的位置。</p>
          <button className="primary-button" onClick={() => window.location.reload()}>重新载入</button>
          <details>
            <summary>错误详情</summary>
            <pre>{String(error?.stack || error?.message || error)}</pre>
          </details>
        </div>
      </div>
    )
  }
}
