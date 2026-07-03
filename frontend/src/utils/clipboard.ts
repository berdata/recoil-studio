export async function copyTextToClipboard(text: string): Promise<boolean> {
  const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard)

  if (writeText) {
    try {
      await writeText(text)
      return true
    } catch {
      // HTTPS 权限被浏览器拒绝时，继续走下面的兼容复制方案。
    }
  }

  // HTTP 部署环境可能没有 navigator.clipboard，使用 textarea 兼容复制。
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
