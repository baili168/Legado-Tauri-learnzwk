# iOS IPA 构建指南

本项目通过 GitHub Action 自动构建未签名的 iOS IPA 文件，供后续签名使用。

## 快速开始

### 通过 GitHub Action 构建（推荐）

1. **推送代码到 GitHub**
   ```bash
   git push origin main
   ```

2. **手动触发构建**
   - 打开 GitHub 仓库页面
   - 点击 **Actions** 标签
   - 选择 **Build iOS IPA** workflow
   - 点击 **Run workflow** 按钮
   - 选择分支（通常是 main）
   - 点击 **Run workflow** 开始构建

3. **下载构建产物**
   - 构建完成后，进入该 workflow 的详情页面
   - 在页面底部 **Artifacts** 区域
   - 点击 **legado-ios-unsigned-ipa** 下载
   - 解压得到 `Legado-unsigned.ipa` 文件

### 触发条件

- **手动触发**: 随时可以在 Actions 页面点击 `Run workflow` 触发
- **标签触发**: 当推送 `v*` 格式的标签时（如 `v1.0.0`），自动触发构建

## 构建流程说明

GitHub Action 执行以下步骤：

1. **环境准备**
   - macOS 15 运行环境
   - Node.js 24 + pnpm
   - Rust + iOS 编译目标 (aarch64-apple-ios)

2. **前端构建**
   - `pnpm install` 安装依赖
   - `pnpm build` 构建 Vue 前端

3. **iOS 项目初始化**
   - `tauri ios init` 生成 Xcode 项目

4. **禁用代码签名**
   - 修改 Xcode 项目配置，彻底禁用签名
   - 使用 `nosign.xcconfig` 覆盖签名设置

5. **构建应用**
   - 使用 `xcodebuild` 原生命令构建 arm64 架构

6. **打包 IPA**
   - 将 `.app` 打包为未签名的 `.ipa` 文件

## 后续签名

下载到未签名的 IPA 文件后，你可以使用以下方式签名：

### 使用 Apple Developer 账号签名

```bash
# 使用 codesign 签名
codesign -f -s "你的证书名称" Payload/Legado.app

# 重新打包
zip -qr Legado-signed.ipa Payload/
```

### 使用第三方工具

- **TrollStore**: 永久签名（无需开发者账号）
- **AltStore**: WiFi 刷新签名
- **Sideloadly**: 图形化签名工具
- **爱思助手**: 一键签名安装

## 常见问题

### Q: 构建失败怎么办？

1. 查看 Actions 日志中的具体错误
2. 常见问题：
   - 依赖安装失败 → 检查网络连接
   - Rust 编译错误 → 查看 Rust 日志详情
   - Xcode 构建错误 → 检查签名配置是否正确移除

### Q: 如何在本地测试构建？

需要在 macOS 电脑上运行：

```bash
# 确保安装了 Xcode
xcode-select --install

# 添加 iOS 目标
rustup target add aarch64-apple-ios

# 运行构建脚本
chmod +x scripts/build-ipa.sh
./scripts/build-ipa.sh
```

### Q: 构建的 IPA 可以直接安装吗？

不可以，未签名的 IPA 需要签名后才能安装到设备上。请参考上方"后续签名"部分。

### Q: 支持哪些设备架构？

目前只构建 **arm64** 架构，支持：
- iPhone 5s 及以上
- iPad Air 及以上
- iPod touch (第6代) 及以上

## 文件说明

| 文件 | 说明 |
|------|------|
| `.github/workflows/build-ipa.yml` | GitHub Action 构建配置 |
| `scripts/build-ipa.sh` | 本地 macOS 构建脚本 |

## 注意事项

1. **Windows 无法构建 iOS** - 必须使用 macOS 或 GitHub Actions
2. **构建时间** - 完整构建约需 15-30 分钟
3. **Rust 缓存** - Action 已配置 Rust 缓存，后续构建会更快
4. **未签名 IPA** - 必须签名后才能安装到真机

## 技术支持

如遇到构建问题，请：
1. 查看 GitHub Actions 的完整构建日志
2. 在 Issues 中提出问题，并附上相关日志截图
