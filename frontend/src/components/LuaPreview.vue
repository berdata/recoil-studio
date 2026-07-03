<script setup lang="ts">
import { ref, watch } from 'vue'
import { api, type GunConfig, type SensitivitySettings, defaultSensitivity } from '../api'

const props = defineProps<{
  guns: GunConfig[]
  sensitivity: SensitivitySettings
}>()

const emit = defineEmits<{
  remove: [index: number]
  back: []
}>()

const luaCode = ref('')
const isLoading = ref(false)
const sens = ref<SensitivitySettings>({ ...defaultSensitivity })

// 同步父组件传入的灵敏度设置
watch(() => props.sensitivity, (val) => {
  sens.value = { ...val }
}, { immediate: true, deep: true })

watch([() => props.guns, sens], async () => {
  if (props.guns.length === 0) {
    luaCode.value = ''
    return
  }

  isLoading.value = true
  try {
    const result = await api.generateLua(props.guns, sens.value)
    if (result.success) {
      luaCode.value = result.lua_code
    }
  } catch (e) {
    console.error('生成失败', e)
  } finally {
    isLoading.value = false
  }
}, { immediate: true, deep: true })

function copyToClipboard() {
  navigator.clipboard.writeText(luaCode.value)
  alert('已复制到剪贴板')
}

function formatRpm(gun: GunConfig) {
  if (!gun.rpm_segments?.length) {
    return `${gun.rpm} RPM`
  }

  // 多段射速压缩成一行摘要，避免枪械列表在多段配置时过高。
  return gun.rpm_segments
    .map(segment => segment.end_bullet === null
      ? `之后 ${segment.rpm}`
      : `≤${segment.end_bullet} 发 ${segment.rpm}`
    )
    .join(' / ')
}

async function downloadLua() {
  try {
    const blob = await api.downloadLua(props.guns, sens.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'macro-G502.lua'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('下载失败', e)
  }
}
</script>

<template>
  <div class="lua-preview">
    <aside class="export-panel">
      <div class="export-head">
        <span>Export Console</span>
        <h3>脚本配置</h3>
      </div>
      
      <div class="guns-list">
        <div v-for="(gun, i) in guns" :key="i" class="gun-item">
          <div class="gun-info">
            <div class="gun-name">{{ gun.name }}</div>
            <div class="gun-stats">
              {{ formatRpm(gun) }} | {{ gun.pattern.length }} 发 | {{ gun.scope_zoom }}x
            </div>
          </div>
          <button class="remove-btn" @click="emit('remove', i)">✕</button>
        </div>
      </div>
      
      <button class="btn btn-secondary" @click="emit('back')">
        添加更多枪械
      </button>

      <div class="sens-section">
        <h3>灵敏度配置</h3>
        <div class="sens-form">
          <div class="sens-field">
            <label>鼠标灵敏度</label>
            <input type="number" v-model.number="sens.mouse_sens" step="0.5" min="0.1" />
          </div>
          <div class="sens-field">
            <label>垂直灵敏度</label>
            <input type="number" v-model.number="sens.vertical_sens" step="0.1" min="0.1" />
          </div>
          <div class="sens-field">
            <label>水平灵敏度</label>
            <input type="number" v-model.number="sens.horizontal_sens" step="0.1" min="0.1" />
          </div>
          <div class="sens-field">
            <label>举枪灵敏度加成</label>
            <input type="number" v-model.number="sens.ads_sens_mul" step="0.1" min="0.1" />
          </div>
          <div class="sens-field">
            <label>举枪瞄准垂直灵敏度</label>
            <input type="number" v-model.number="sens.ads_vertical_sens" step="0.1" min="0.1" />
          </div>
          <div class="sens-field">
            <label>举枪瞄准水平灵敏度</label>
            <input type="number" v-model.number="sens.ads_horizontal_sens" step="0.1" min="0.1" />
          </div>
          <div class="sens-field">
            <label>屏幕距离系数</label>
            <input type="number" v-model.number="sens.screen_dist_coeff" step="0.01" min="0.01" />
          </div>
          <div class="sens-field">
            <label>基础视场角 (FOV)</label>
            <input type="number" v-model.number="sens.base_fov" step="1" min="60" max="120" />
          </div>
          <div class="sens-field sens-toggle">
            <label>是否屏息</label>
            <input type="checkbox" v-model="sens.hold_breath" />
          </div>
        </div>
      </div>
    </aside>
    
    <div class="code-section">
      <div class="code-header">
        <div>
          <span>Lua Output</span>
          <h3>生成的宏脚本</h3>
        </div>
        <div class="code-actions">
          <button class="btn btn-small" @click="copyToClipboard">
            复制
          </button>
          <button class="btn btn-small btn-primary" @click="downloadLua">
            下载
          </button>
        </div>
      </div>
      
      <div v-if="isLoading" class="loading">
        正在生成...
      </div>
      
      <pre v-else class="code"><code>{{ luaCode }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.lua-preview {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  min-height: calc(100vh - 196px);
}

.export-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
  padding: 14px;
}

.export-head span,
.code-header span {
  color: var(--primary);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.export-head h3,
.code-header h3 {
  margin: 0;
  color: var(--text);
}

.guns-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gun-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--panel-3);
  border: 1px solid var(--border);
  border-radius: 8px;
  gap: 10px;
}

.gun-name {
  font-weight: bold;
}

.gun-stats {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 3px;
  line-height: 1.45;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 107, 107, 0.14);
  border: 1px solid rgba(255, 107, 107, 0.35);
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: rgba(255, 107, 107, 0.28);
}

.code-section {
  display: flex;
  flex-direction: column;
  background: var(--panel-3);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: var(--panel-2);
  border-bottom: 1px solid var(--border);
}

.code-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  background: var(--panel);
  color: var(--text);
}

.btn-small {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn-primary {
  background: var(--primary);
  color: #06110d;
  border-color: var(--primary);
  font-weight: 600;
}

.btn-secondary {
  background: var(--panel-2);
  color: var(--text);
}

.btn-secondary:hover {
  background: #1b2834;
}

.sens-section {
  border-top: 1px solid var(--border);
  padding-top: 15px;
  min-height: 0;
}

.sens-section h3 {
  margin: 0 0 12px 0;
  color: var(--primary);
  font-size: 0.95rem;
}

.sens-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sens-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sens-field label {
  font-size: 0.8rem;
  color: var(--muted);
}

.sens-field input {
  min-height: 40px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-3);
  color: var(--text);
  font-size: 0.85rem;
}

.sens-toggle {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.sens-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.code {
  flex: 1;
  margin: 0;
  padding: 20px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #b7f5df;
  background: transparent;
}

@media (max-width: 900px) {
  .lua-preview {
    grid-template-columns: 1fr;
  }

  .sens-form {
    grid-template-columns: 1fr;
  }
}
</style>
