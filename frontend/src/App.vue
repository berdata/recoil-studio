<script setup lang="ts">
import { computed, ref } from 'vue'
import ImageUpload from './components/ImageUpload.vue'
import PatternEditor from './components/PatternEditor.vue'
import LuaPreview from './components/LuaPreview.vue'
import { defaultSensitivity, type FireRateSegment, type SensitivitySettings } from './api'

interface Point {
  x: number
  y: number
}

interface RecoilData {
  y: number
  x: number
}

interface Gun {
  name: string
  rpm: number
  rpm_segments?: FireRateSegment[]
  vertical_mul: number
  horizontal_mul: number
  scope_zoom: number
  hold_breath_coeff: number
  pattern: RecoilData[]
}

const points = ref<Point[]>([])
const pattern = ref<RecoilData[]>([])
const imageUrl = ref<string>('')
const imageWidth = ref(0)
const imageHeight = ref(0)
const guns = ref<Gun[]>([])
const currentStep = ref(1)
const sensitivity = ref<SensitivitySettings>({ ...defaultSensitivity })

const steps = [
  { id: 1, label: '导入', desc: '弹道图或数据' },
  { id: 2, label: '校准', desc: '编辑弹道和枪械' },
  { id: 3, label: '导出', desc: '生成 Lua 宏' }
]

const currentTitle = computed(() => steps.find(step => step.id === currentStep.value)?.label ?? '导入')
const currentDesc = computed(() => steps.find(step => step.id === currentStep.value)?.desc ?? '')
const totalBullets = computed(() => pattern.value.length)
const totalPoints = computed(() => points.value.length)

function handlePatternDetected(data: {
  points: Point[]
  pattern: RecoilData[]
  imageUrl: string
  width: number
  height: number
}) {
  points.value = data.points
  pattern.value = data.pattern
  imageUrl.value = data.imageUrl
  imageWidth.value = data.width
  imageHeight.value = data.height
  currentStep.value = 2
}

function handleDataImported(data: { pattern: RecoilData[] }) {
  // 导入纯弹道数据时生成虚拟点位，让画布编辑器仍能显示和二次调整。
  let y = 400
  let x = 100
  const pts: Point[] = [{ x, y }]

  for (const r of data.pattern) {
    y -= r.y * 2
    x -= r.x * 2
    pts.push({ x, y })
  }

  points.value = pts
  pattern.value = data.pattern
  imageUrl.value = ''
  imageWidth.value = 300
  imageHeight.value = 500
  currentStep.value = 2
}

function handlePatternUpdated(newPattern: RecoilData[]) {
  pattern.value = newPattern
}

function handleAddGun(gun: Omit<Gun, 'scope_zoom' | 'hold_breath_coeff'> & Partial<Pick<Gun, 'scope_zoom' | 'hold_breath_coeff'>>) {
  guns.value.push({
    ...gun,
    scope_zoom: gun.scope_zoom ?? 1,
    hold_breath_coeff: gun.hold_breath_coeff ?? 1,
    // 固定射速枪械不发送 rpm_segments，后端会继续按原 rpm 生成脚本。
    rpm_segments: gun.rpm_segments?.length ? gun.rpm_segments : undefined,
  })
  currentStep.value = 3
}

function handleRemoveGun(index: number) {
  guns.value.splice(index, 1)
  if (guns.value.length === 0) {
    currentStep.value = 2
  }
}

function handleReset() {
  points.value = []
  pattern.value = []
  imageUrl.value = ''
  imageWidth.value = 0
  imageHeight.value = 0
  currentStep.value = 1
}

function goStep(stepId: number) {
  if (stepId === 1) {
    handleReset()
    return
  }

  if (stepId === 2 && pattern.value.length > 0) {
    currentStep.value = 2
    return
  }

  if (stepId === 3 && guns.value.length > 0) {
    currentStep.value = 3
  }
}
</script>

<template>
  <div class="studio-shell">
    <aside class="side-rail">
      <div class="brand-block">
        <span class="brand-mark">RS</span>
        <div>
          <h1>Recoil Studio</h1>
          <p>Logitech Macro Workbench</p>
        </div>
      </div>

      <nav class="flow-nav" aria-label="工作流程">
        <button
          v-for="step in steps"
          :key="step.id"
          :class="['flow-item', { active: currentStep === step.id, done: currentStep > step.id }]"
          type="button"
          @click="goStep(step.id)"
        >
          <span class="flow-index">0{{ step.id }}</span>
          <span>
            <strong>{{ step.label }}</strong>
            <small>{{ step.desc }}</small>
          </span>
        </button>
      </nav>

      <div class="side-summary">
        <div class="summary-row">
          <span>弹道点</span>
          <strong>{{ totalPoints }}</strong>
        </div>
        <div class="summary-row">
          <span>子弹数</span>
          <strong>{{ totalBullets }}</strong>
        </div>
        <div class="summary-row">
          <span>枪械数</span>
          <strong>{{ guns.length }}</strong>
        </div>
      </div>

      <div class="gun-strip" v-if="guns.length > 0">
        <span class="strip-title">已添加</span>
        <button
          v-for="(gun, index) in guns"
          :key="`${gun.name}-${index}`"
          class="mini-gun"
          type="button"
          @click="currentStep = 3"
        >
          <span>{{ gun.name }}</span>
          <small>{{ gun.pattern.length }} 发</small>
        </button>
      </div>
    </aside>

    <main class="workbench">
      <header class="top-bar">
        <div>
          <span class="eyebrow">当前工作区</span>
          <h2>{{ currentTitle }}</h2>
          <p>{{ currentDesc }}</p>
        </div>
        <div class="status-cluster">
          <span :class="['status-pill', { live: pattern.length > 0 }]">
            {{ pattern.length > 0 ? '弹道已载入' : '等待数据' }}
          </span>
          <button class="ghost-action" type="button" @click="handleReset">重置</button>
        </div>
      </header>

      <section class="workspace">
        <ImageUpload
          v-if="currentStep === 1"
          @detected="handlePatternDetected"
          @imported="handleDataImported"
        />

        <PatternEditor
          v-if="currentStep === 2"
          :points="points"
          :pattern="pattern"
          :image-url="imageUrl"
          :image-width="imageWidth"
          :image-height="imageHeight"
          @update="handlePatternUpdated"
          @add-gun="handleAddGun"
          @back="handleReset"
        />

        <LuaPreview
          v-if="currentStep === 3"
          :guns="guns"
          :sensitivity="sensitivity"
          @remove="handleRemoveGun"
          @back="currentStep = 2"
        />
      </section>
    </main>
  </div>
</template>

<style>
:root {
  --bg: #080b0f;
  --panel: #0f151b;
  --panel-2: #141c24;
  --panel-3: #0a1016;
  --surface: #18232d;
  --border: #253341;
  --border-soft: rgba(143, 167, 188, 0.18);
  --text: #eef4f8;
  --muted: #91a4b5;
  --muted-2: #617384;
  --primary: #27d6a3;
  --primary-strong: #13b886;
  --accent: #f5b14c;
  --danger: #ff6b6b;
  --focus: rgba(39, 214, 163, 0.32);
  --shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 8%, rgba(39, 214, 163, 0.12), transparent 28%),
    linear-gradient(135deg, #080b0f 0%, #10151b 48%, #0b0f14 100%);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  min-height: 44px;
}

input,
select,
textarea {
  color-scheme: dark;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.studio-shell {
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  min-height: 100vh;
}

.side-rail {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px;
  background: rgba(10, 16, 22, 0.94);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-soft);
}

.brand-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(39, 214, 163, 0.45);
  border-radius: 8px;
  background: rgba(39, 214, 163, 0.12);
  color: var(--primary);
  font-weight: 800;
}

.brand-block h1 {
  font-size: 1.1rem;
  letter-spacing: 0;
}

.brand-block p,
.top-bar p,
.flow-item small,
.mini-gun small,
.eyebrow {
  color: var(--muted);
}

.flow-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-item {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s, border-color 0.2s;
}

.flow-item:hover,
.flow-item.active {
  background: var(--panel-2);
  border-color: var(--border);
}

.flow-item.done .flow-index,
.flow-item.active .flow-index {
  color: #06120e;
  background: var(--primary);
  border-color: var(--primary);
}

.flow-index {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.flow-item strong,
.flow-item small {
  display: block;
}

.flow-item strong {
  font-size: 0.95rem;
}

.flow-item small {
  margin-top: 2px;
  font-size: 0.76rem;
}

.side-summary {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 0.88rem;
}

.summary-row strong {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.gun-strip {
  display: grid;
  gap: 8px;
}

.strip-title {
  color: var(--muted-2);
  font-size: 0.76rem;
  text-transform: uppercase;
}

.mini-gun {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 10px 12px;
  cursor: pointer;
}

.workbench {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 18px;
}

.top-bar {
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 21, 27, 0.88);
  box-shadow: var(--shadow);
}

.eyebrow {
  display: block;
  margin-bottom: 4px;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.top-bar h2 {
  font-size: 1.55rem;
  letter-spacing: 0;
}

.status-cluster {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-pill,
.ghost-action {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--border);
  padding: 0 14px;
}

.status-pill {
  color: var(--muted);
  background: var(--panel);
}

.status-pill.live {
  color: var(--primary);
  border-color: rgba(39, 214, 163, 0.34);
  background: rgba(39, 214, 163, 0.1);
}

.ghost-action {
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.ghost-action:hover {
  background: var(--panel-2);
}

.workspace {
  min-height: calc(100vh - 158px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 21, 27, 0.92);
  box-shadow: var(--shadow);
  padding: 18px;
  overflow: hidden;
}

@media (max-width: 1040px) {
  .studio-shell {
    grid-template-columns: 1fr;
  }

  .side-rail {
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .flow-nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 760px) {
  .workbench,
  .side-rail {
    padding: 14px;
  }

  .top-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .flow-nav {
    grid-template-columns: 1fr;
  }

  .workspace {
    min-height: auto;
    padding: 12px;
  }
}
</style>
