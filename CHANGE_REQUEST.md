# 自拍模式：上次选择的图片本地缓存

## 目标
用户上次在自拍模式选好的照片（相机拍的 + 相册选的），下次再进这个页面时自动回显在预览区，不用重新挑；同时能一键清空。

## 存储方案

- 存储：`localStorage`，key = `puzzle-selfie-images-v1`
- 内容：dataURL 数组 JSON。因为 localStorage 单域上限 ~5MB，需要保守限流：
  - 单张 dataURL 超过 1.5MB 时跳过（相机拍的通常 100-500KB，相册选的可能 2-4MB 需要压缩后再存，先简单跳过）。
  - 累加超过 4MB 时截断，仅保留能塞下的前 N 张。
  - 若第一张就超，`try { localStorage.setItem(...) } catch { console.warn; 清空 }`。
- 触发时机：
  - `onMounted`：读取，赋值给 `images.value`，并调用 `measureImage` 测最后一张。
  - `watch(images, ..., { deep: false })`：数组变化时写回。（Vue3 ref 数组本身 push/splice 是浅层触发，deep:false 够用）

## 修改（`app/pages/play/selfie.vue`）

### 1. 顶部导入 & 常量

```ts
const CACHE_KEY = 'puzzle-selfie-images-v1'
const MAX_BYTES = 4 * 1024 * 1024   // 4MB
const PER_ITEM_MAX_BYTES = 1.5 * 1024 * 1024
```

### 2. onMounted 里加载

```ts
onMounted(() => {
  // ... 现有 resize/orientationchange 监听保留
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string' && x.startsWith('data:'))) {
        images.value = arr
        // 测最后一张，让 maxPieces 立刻正确
        if (arr.length > 0) measureImage(arr[arr.length - 1])
      }
    }
  } catch { /* ignore */ }
})
```

### 3. 写回

```ts
function persistImages() {
  try {
    let total = 0
    const kept: string[] = []
    for (const url of images.value) {
      const size = url.length // 近似字节数（base64 每 4 字符 ≈ 3 字节，做保守估算按字符数）
      if (size > PER_ITEM_MAX_BYTES) continue
      if (total + size > MAX_BYTES) break
      kept.push(url)
      total += size
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(kept))
  } catch {
    // 配额溢出：清掉旧的，再试写空
    try { localStorage.removeItem(CACHE_KEY) } catch {}
  }
}

watch(images, () => persistImages(), { deep: false })
```

（`images` 是 `ref<string[]>`，`push/splice` 会触发 watch。）

### 4. UI 提示 + 清空按钮

在 `<div class="preview" v-if="images.length">` 下方（保留 preview 网格）新增一行：

```html
<div v-if="images.length" class="preview-actions">
  <span class="preview-note">已保存 {{ images.length }} 张，下次进入自动回显</span>
  <button class="ghost-btn small" @click="clearImages">清空</button>
</div>
```

```ts
function clearImages() {
  images.value = []
  imgDim.value = null
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}
```

样式追加：
```css
.preview-actions {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 4px;
}
.preview-note { font-size: 12px; color: var(--color-text-soft); }
.ghost-btn.small { padding: 4px 10px; font-size: 12px; flex: 0 0 auto; }
```

### 5. 通关/放弃时不清空

不动 `onSuccess/onFail/onAbort/onNext` 的现有逻辑。用户想清就点"清空"按钮。

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(selfie): cache last picked images in localStorage"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
