#!/bin/bash
# iOS IPA 构建脚本 - 生成未签名的IPA
# 使用方法: ./scripts/build-ipa.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}开始构建 iOS IPA${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查是否在macOS上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}错误: 此脚本必须在 macOS 上运行${NC}"
    exit 1
fi

# 检查Xcode是否安装
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}错误: 未安装 Xcode 命令行工具${NC}"
    echo "请运行: xcode-select --install"
    exit 1
fi

# 检查 Rust iOS 目标
if ! rustup target list | grep -q "aarch64-apple-ios (installed)"; then
    echo -e "${YELLOW}正在添加 iOS 编译目标...${NC}"
    rustup target add aarch64-apple-ios
fi

# 检查并安装依赖
echo -e "${YELLOW}检查并安装依赖...${NC}"
if [ ! -d "node_modules" ]; then
    pnpm install
fi

# 构建前端
echo -e "${YELLOW}构建前端代码...${NC}"
pnpm build

# 初始化 iOS 项目（如果不存在）
if [ ! -d "src-tauri/gen/apple" ]; then
    echo -e "${YELLOW}初始化 Tauri iOS 项目...${NC}"
    export CI=false
    pnpm tauri ios init -v
else
    echo -e "${GREEN}iOS 项目已存在${NC}"
fi

# 找到 Xcode 项目文件
PBXPROJ=$(find src-tauri/gen/apple -name "project.pbxproj" | head -1)
if [ -z "$PBXPROJ" ]; then
    echo -e "${RED}错误: 找不到 project.pbxproj 文件${NC}"
    exit 1
fi

echo -e "${YELLOW}修改 Xcode 配置以禁用签名...${NC}"

# 物理替换签名配置
sed -i '' 's/CODE_SIGN_STYLE = Automatic/CODE_SIGN_STYLE = Manual/g' "$PBXPROJ"
sed -i '' 's/CODE_SIGNING_REQUIRED = YES/CODE_SIGNING_REQUIRED = NO/g' "$PBXPROJ"
sed -i '' 's/CODE_SIGNING_ALLOWED = YES/CODE_SIGNING_ALLOWED = NO/g' "$PBXPROJ"

# 创建 xcconfig 彻底覆盖签名配置
cat <<EOF > nosign.xcconfig
CODE_SIGN_IDENTITY =
CODE_SIGNING_REQUIRED = NO
CODE_SIGNING_ALLOWED = NO
CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM =
PROVISIONING_PROFILE_SPECIFIER =
EOF

# 找到Xcode项目信息
XCODE_PROJECT=$(find src-tauri/gen/apple -name "*.xcodeproj" -type d | head -1)
XCWORKSPACE=$(find src-tauri/gen/apple -name "*.xcworkspace" -type d | head -1)
SCHEME=$(xcodebuild -list -project "$XCODE_PROJECT" 2>/dev/null | grep -A 20 "Schemes:" | grep -v "Schemes:" | head -1 | xargs)

if [ -z "$SCHEME" ]; then
    SCHEME="Legado"
fi

echo -e "${YELLOW}Xcode 项目: $XCODE_PROJECT${NC}"
echo -e "${YELLOW}Scheme: $SCHEME${NC}"

# 使用原生 xcodebuild 强制免签打包
echo -e "${YELLOW}开始构建...${NC}"

if [ -n "$XCWORKSPACE" ]; then
    xcodebuild clean build \
        -workspace "$XCWORKSPACE" \
        -scheme "$SCHEME" \
        -configuration release \
        -sdk iphoneos \
        -arch arm64 \
        -xcconfig nosign.xcconfig
else
    xcodebuild clean build \
        -project "$XCODE_PROJECT" \
        -scheme "$SCHEME" \
        -configuration release \
        -sdk iphoneos \
        -arch arm64 \
        -xcconfig nosign.xcconfig
fi

# 创建 IPA
echo -e "${YELLOW}正在打包生成 IPA 文件...${NC}"

# 查找 .app 文件
APP_PATH=$(find src-tauri/gen/apple -name "*.app" -path "*iphoneos*" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find src-tauri/gen/apple -name "*.app" -type d 2>/dev/null | head -1)
fi

if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
    echo -e "${GREEN}找到编译好的 app: $APP_PATH${NC}"
    
    mkdir -p Payload
    cp -R "$APP_PATH" Payload/
    
    IPA_NAME="Legado-unsigned.ipa"
    zip -qr "$IPA_NAME" Payload/
    
    # 清理
    rm -rf Payload
    rm -f nosign.xcconfig
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ IPA 构建成功!${NC}"
    echo -e "${GREEN}文件路径: $(pwd)/$IPA_NAME${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}❌ 错误：找不到编译好的 .app 文件${NC}"
    exit 1
fi
