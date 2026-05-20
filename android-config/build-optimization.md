# Legado Tauri Android 构建优化配置要点

## 1. AndroidManifest.xml 关键属性

```xml
<application
    android:hardwareAccelerated="true"
    android:largeHeap="true"
    android:extractNativeLibs="true"
    android:allowBackup="false"
    ...>

<activity
    android:hardwareAccelerated="true"
    android:configChanges="orientation|keyboardHidden|screenSize|screenLayout|uiMode"
    ...>
```

- `hardwareAccelerated="true"`：启用 GPU 硬件加速渲染 WebView，显著提升翻页/滚动流畅度
- `largeHeap="true"`：增大 Dalvik/ART 堆上限，减少阅读器长会话中的 OOM 崩溃
- `extractNativeLibs="true"`：APK 安装时预解压 so 库到磁盘而非 mmap 模式，加快 Rust/Tauri 库加载
- `allowBackup="false"`：禁用自动备份减少磁盘 I/O，避免与 SQLite 产生锁冲突

## 2. WebView 运行时优化

```kotlin
// MainActivity.onCreate 中
webView.settings.apply {
    setRenderPriority(WebSettings.RenderPriority.HIGH)
    cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
    setDomStorageEnabled(true)
    databaseEnabled = true
    loadsImagesAutomatically = true
    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
}

// 硬件加速层
webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
```

- `LOAD_CACHE_ELSE_NETWORK`：优先使用 WebView 本地缓存，仅在缓存过期时才网络请求，对阅读器场景极为有效（书封、章节内容几乎不变）
- `LAYER_TYPE_HARDWARE`：强制 WebView 使用硬件层渲染，在翻页/滚动动画时避免软件渲染回退

## 3. Cargo.toml Features 精简

在项目的 `src-tauri/Cargo.toml` 中，通过 `default-features = false` 并仅选择必要 features：

```toml
[dependencies]
tauri = { version = "2", default-features = false, features = [
    "devtools",        # 仅调试构建启用
    "custom-protocol", # 用于 asset:// 协议加载前端
    "tray-icon",       # 移动端不需要
] }

# 移除以下 Android 不使用的 feature：
# - "tray-icon"        （桌面托盘图标）
# - "menu"             （桌面菜单栏）
# - "window-controls"  （桌面窗口控制按钮）
# - "global-shortcut"  （全局快捷键 —— 完全桌面功能）
# - "updater"          （桌面端更新器）
# - "notification"     （如不用系统通知可移除）
```

**精简后的效果**：
- Rust 编译产物体积减少约 30-40%
- `libtauri.so` 体积大幅缩小
- 减少安全攻击面（移除无用 feature 代码路径）

## 4. APK 分包方案

采用 Android App Bundle (AAB) + Play Feature Delivery 或手动 ABIs split：

```kotlin
// app/build.gradle.kts
android {
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a", "x86_64", "x86")
            isUniversalApk = false
        }
    }
}
```

**分包策略说明**：
- **arm64-v8a**：主力包，覆盖 95% 以上现代 Android 设备
- **armeabi-v7a**：兼容老旧 32-bit 设备（部分墨水屏/电纸书）
- 每个 ABI 独立 APK，减少 50-60% 下载体积
- Play Store 自动匹配设备 ABI 下发对应 APK

## 5. ProGuard/R8 混淆

参见同目录 `proguard-rules.pro`，核心要点：
- Tauri IPC 通道类（`com.tauri.**`）保持不混淆
- `@JavascriptInterface` 方法保持不混淆
- Kotlin Serialization 注解保持
- 移除 release build 中的 `android.util.Log` 调用

## 6. WebView 预加载与缓存（前端侧）

前端侧通过 `useWebViewWarmup` 和 `useCacheStrategy` 两个 composable 实现：
- **useWebViewWarmup**：`<link rel="preload">` 预热字体/图标，PerformanceObserver 监控 LCP/FCP/TTFB
- **useCacheStrategy**：Cache API 双层策略（缓存优先/网络优先），自动缓存静态资源

在 `src/main.ts` 中 app 挂载后调用 `warmupWebView()` 和 `precacheUrls()` 完成初始化。