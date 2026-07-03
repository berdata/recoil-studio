<script setup lang="ts">
import { ref } from 'vue'
import { api, type Point, type RecoilData } from '../api'

const emit = defineEmits<{
  detected: [{
    points: Point[]
    pattern: RecoilData[]
    imageUrl: string
    width: number
    height: number
  }]
  imported: [{ pattern: RecoilData[] }]
}>()

const activeTab = ref<'image' | 'data'>('image')
const isDragging = ref(false)
const isLoading = ref(false)
const error = ref('')
const scaleX = ref(1.0)
const scaleY = ref(1.0)
const minDist = ref(5)
const dataInput = ref('')

// 预览状态
const previewMode = ref(false)
const previewPoints = ref<Point[]>([])
const previewPattern = ref<RecoilData[]>([])
const previewImageUrl = ref('')
const previewWidth = ref(0)
const previewHeight = ref(0)

async function handleFile(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = '请上传图片文件'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const result = await api.detectPattern(file, scaleX.value, scaleY.value, minDist.value)
    
    if (result.success) {
      previewPoints.value = result.points
      previewPattern.value = result.pattern
      previewImageUrl.value = URL.createObjectURL(file)
      previewWidth.value = result.image_width
      previewHeight.value = result.image_height
      previewMode.value = true
    } else {
      error.value = result.message
    }
  } catch (e: any) {
    error.value = e.message || '识别失败'
  } finally {
    isLoading.value = false
  }
}

function confirmDetection() {
  emit('detected', {
    points: previewPoints.value,
    pattern: previewPattern.value,
    imageUrl: previewImageUrl.value,
    width: previewWidth.value,
    height: previewHeight.value
  })
}

function cancelPreview() {
  previewMode.value = false
  previewPoints.value = []
  previewPattern.value = []
  previewImageUrl.value = ''
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
}

function parseDataInput() {
  error.value = ''
  
  try {
    const text = dataInput.value.trim()
    let data: RecoilData[] = []
    
    // 尝试解析 JSON 格式
    if (text.startsWith('[') || text.startsWith('{')) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        data = parsed.map(item => ({
          y: Number(item.y) || 0,
          x: Number(item.x) || 0
        }))
      }
    } else {
      // 尝试解析 Lua 格式或简单格式
      // 匹配 {y=数字, x=数字} 或 数字,数字
      const luaPattern = /\{y\s*=\s*([-\d.]+)\s*,\s*x\s*=\s*([-\d.]+)\}/g
      const simplePattern = /([-\d.]+)\s*[,\s]\s*([-\d.]+)/g
      
      let match
      while ((match = luaPattern.exec(text)) !== null) {
        if (match[1] && match[2]) {
          data.push({ y: parseFloat(match[1]), x: parseFloat(match[2]) })
        }
      }
      
      if (data.length === 0) {
        while ((match = simplePattern.exec(text)) !== null) {
          if (match[1] && match[2]) {
            data.push({ y: parseFloat(match[1]), x: parseFloat(match[2]) })
          }
        }
      }
    }
    
    if (data.length === 0) {
      error.value = '无法解析数据，请检查格式'
      return
    }
    
    emit('imported', { pattern: data })
    
  } catch (e: any) {
    error.value = '解析失败: ' + e.message
  }
}
</script>

<template>
  <div class="upload-workspace">
    <div v-if="previewMode" class="preview-mode">
      <div class="preview-header">
        <div>
          <span class="section-kicker">识别结果</span>
          <h3>确认弹道点</h3>
        </div>
        <span class="preview-info">{{ previewPoints.length }} 个点 / {{ previewPattern.length }} 发</span>
      </div>
      
      <div class="preview-content">
        <div class="preview-image">
          <img :src="previewImageUrl" alt="Preview" />
          <svg class="preview-overlay" :viewBox="`0 0 ${previewWidth} ${previewHeight}`">
            <polyline
              :points="previewPoints.map(p => `${p.x},${p.y}`).join(' ')"
              fill="none"
              stroke="rgba(32, 201, 151, 0.65)"
              stroke-width="2"
            />
            <circle
              v-for="(point, i) in previewPoints"
              :key="i"
              :cx="point.x"
              :cy="point.y"
              r="5"
              fill="#20c997"
              stroke="#fff"
              stroke-width="1"
            />
          </svg>
        </div>
        
        <div class="preview-data">
          <h4>弹道数据 ({{ previewPattern.length }} 发)</h4>
          <div class="data-list">
            <div v-for="(p, i) in previewPattern.slice(0, 10)" :key="i" class="data-item">
              <span class="num">#{{ i + 1 }}</span>
              <span>Y: {{ p.y.toFixed(2) }}</span>
              <span>X: {{ p.x.toFixed(2) }}</span>
            </div>
            <div v-if="previewPattern.length > 10" class="data-more">
              ... 还有 {{ previewPattern.length - 10 }} 发
            </div>
          </div>
        </div>
      </div>
      
      <div class="preview-actions">
        <button class="btn btn-secondary" @click="cancelPreview">重新上传</button>
        <button class="btn btn-primary" @click="confirmDetection">确认并编辑</button>
      </div>
    </div>
    
    <div v-else>
      <div class="import-grid">
        <aside class="import-panel">
          <span class="section-kicker">输入源</span>
          <h3>选择弹道来源</h3>
          <div class="source-switch">
            <button
              :class="['source-option', { active: activeTab === 'image' }]"
              type="button"
              @click="activeTab = 'image'"
            >
              <span>弹道图识别</span>
              <small>上传带标记的图片</small>
            </button>
            <button
              :class="['source-option', { active: activeTab === 'data' }]"
              type="button"
              @click="activeTab = 'data'"
            >
              <span>弹道数据导入</span>
              <small>粘贴 Lua / JSON / 文本</small>
            </button>
          </div>
        </aside>

        <section class="import-stage">
          <div v-if="activeTab === 'image'" class="image-import">
            <div class="params">
              <div class="param">
                <label>X缩放</label>
                <input type="number" v-model.number="scaleX" step="0.1" min="0.1" max="10" />
              </div>
              <div class="param">
                <label>Y缩放</label>
                <input type="number" v-model.number="scaleY" step="0.1" min="0.1" max="10" />
              </div>
              <div class="param">
                <label>点间距</label>
                <input type="number" v-model.number="minDist" min="1" max="20" />
              </div>
            </div>

            <div
              :class="['drop-zone', { dragging: isDragging, loading: isLoading }]"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleDrop"
              @click="($refs.fileInput as HTMLInputElement).click()"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                hidden
                @change="handleFileInput"
              />

              <div v-if="isLoading" class="loading">
                <div class="spinner"></div>
                <p>正在识别弹道...</p>
              </div>

              <div v-else class="placeholder">
                <div class="file-icon" aria-hidden="true"></div>
                <strong>拖拽弹道图到这里</strong>
                <span>或点击选择 PNG / JPG 文件</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'data'" class="data-import">
            <div class="format-block">
              <span class="section-kicker">支持格式</span>
              <p>JSON、Lua 表达式、每行 Y/X 数值都可以解析。</p>
              <code>[{"y": 10, "x": 2}]</code>
              <code>{y=10, x=2}</code>
              <code>10, 2</code>
            </div>

            <textarea
              v-model="dataInput"
              placeholder="粘贴弹道数据..."
              rows="13"
            ></textarea>

            <button class="btn btn-primary" type="button" @click="parseDataInput" :disabled="!dataInput.trim()">
              导入数据
            </button>
          </div>
        </section>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.upload-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.import-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  min-height: 560px;
}

.import-panel,
.import-stage {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
}

.import-panel {
  padding: 18px;
}

.import-panel h3 {
  margin: 6px 0 18px;
  font-size: 1.2rem;
}

.section-kicker {
  color: var(--primary);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.source-switch {
  display: grid;
  gap: 10px;
}

.source-option {
  display: grid;
  gap: 4px;
  width: 100%;
  min-height: 76px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.source-option small {
  color: var(--muted);
}

.source-option.active {
  border-color: rgba(39, 214, 163, 0.5);
  background: rgba(39, 214, 163, 0.1);
}

.import-stage {
  padding: 18px;
}

.image-import {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 16px;
  min-height: 100%;
}

.params {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 10px;
}

.param {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.param label {
  font-size: 0.85rem;
  color: var(--muted);
}

.param input {
  width: 100%;
  min-height: 42px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-3);
  color: var(--text);
  text-align: center;
}

.drop-zone {
  border: 1px dashed var(--border);
  border-radius: 8px;
  min-height: 410px;
  padding: 42px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  display: grid;
  place-items: center;
  background: var(--panel-3);
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--primary);
  background: rgba(32, 201, 151, 0.08);
}

.drop-zone.loading {
  pointer-events: none;
}

.file-icon {
  width: 42px;
  height: 50px;
  margin: 0 auto 12px;
  border: 2px solid var(--primary);
  border-radius: 6px;
  position: relative;
}

.file-icon::after {
  content: '';
  position: absolute;
  right: -2px;
  top: -2px;
  width: 14px;
  height: 14px;
  background: var(--panel);
  border-left: 2px solid var(--primary);
  border-bottom: 2px solid var(--primary);
  border-radius: 0 6px 0 6px;
}

.placeholder {
  display: grid;
  justify-items: center;
  gap: 8px;
}

.placeholder span {
  font-size: 0.9rem;
  color: var(--muted);
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.data-import {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 14px;
  min-height: 100%;
}

.format-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-3);
}

.format-block p {
  color: var(--muted);
  font-size: 0.9rem;
}

.format-block code {
  background: var(--panel-3);
  border: 1px solid var(--border);
  padding: 8px;
  border-radius: 4px;
  color: #b7f5df;
}

textarea {
  width: 100%;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-3);
  color: var(--text);
  font-family: 'Consolas', monospace;
  font-size: 0.9rem;
  resize: vertical;
  grid-row: span 2;
}

/* 预览模式 */
.preview-mode {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-header h3 {
  color: var(--primary);
}

.preview-info {
  color: var(--muted);
}

.preview-content {
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 20px;
}

.preview-image {
  position: relative;
  background: var(--panel-3);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  padding: 20px;
}

.preview-image img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.preview-overlay {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 40px);
  max-height: 400px;
  pointer-events: none;
}

.preview-data {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 15px;
}

.preview-data h4 {
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 0.9rem;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 300px;
  overflow-y: auto;
}

.data-item {
  display: flex;
  gap: 10px;
  padding: 5px 8px;
  background: var(--panel-3);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
}

.data-item .num {
  color: var(--primary);
  min-width: 25px;
}

.data-more {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 10px;
}

.preview-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

/* 按钮 */
.btn {
  padding: 12px 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #06110d;
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(32, 201, 151, 0.18);
}

.btn-secondary {
  background: var(--panel-2);
  color: var(--text);
}

.btn-secondary:hover {
  background: #1b2834;
}

.error {
  background: rgba(255, 100, 100, 0.2);
  border: 1px solid #f66;
  color: #f66;
  padding: 10px;
  border-radius: 6px;
  text-align: center;
}

@media (max-width: 700px) {
  .import-grid,
  .data-import {
    grid-template-columns: 1fr;
  }

  .params {
    grid-template-columns: 1fr;
  }

  .preview-content {
    grid-template-columns: 1fr;
  }
}
</style>
