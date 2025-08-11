# 测试说明

本目录包含项目的所有测试文件，按照 `*.test.js` 的命名约定组织。

## 测试文件结构

```
test/
├── node.test.js              # Node.js 基础功能测试
├── config.test.js            # 配置文件测试
├── version-logic.test.js     # 版本逻辑测试
├── duplicate-prevention.test.js  # 防重复翻译测试
├── translation.test.js       # 翻译功能测试
├── run-tests.js             # 测试运行器
├── package.json             # 测试配置
└── README.md               # 本文件
```

## 运行测试

### 运行所有测试
```bash
# 使用测试运行器
node test/run-tests.js

# 或者逐个运行
node test/node.test.js
node test/config.test.js
node test/version-logic.test.js
node test/duplicate-prevention.test.js
node test/translation.test.js
```

### 运行单个测试
```bash
# 运行指定测试文件
node test/run-tests.js node.test.js
```

### 使用 Jest（如果已安装）
```bash
cd test
npm install jest --save-dev
npm test
```

## 测试说明

### 1. node.test.js
- 测试 Node.js 基础环境
- 验证核心模块是否可用
- 检查基本 JavaScript 功能

### 2. config.test.js
- 测试配置文件读取
- 验证配置文件结构
- 检查成功率计算功能

### 3. version-logic.test.js
- 测试版本配置逻辑
- 验证版本特定功能
- 检查配置文件解析

### 4. duplicate-prevention.test.js
- 测试防重复翻译功能
- 验证文本过滤逻辑
- 检查翻译缓存机制

### 5. translation.test.js
- 测试翻译API功能
- 验证多语言支持
- 检查模板翻译功能

## 环境要求

### 基础要求
- Node.js (推荐 v14+)
- 项目根目录下的配置文件

### 翻译测试要求
需要在项目根目录创建 `.env` 文件并配置：
```
BAIDU_TRANSLATE_APPID=your_app_id
BAIDU_TRANSLATE_SECRET=your_secret_key
```

如果没有配置翻译API，相关测试会被跳过。

## 测试输出

每个测试文件会输出详细的测试结果，包括：
- ✅ 通过的测试
- ❌ 失败的测试
- ⚠️ 跳过的测试（如API未配置）
- 📊 统计信息

## 故障排除

### 常见问题

1. **模块找不到错误**
   ```
   Error: Cannot find module '../scripts/translator'
   ```
   确保在项目根目录运行测试，或检查模块路径是否正确。

2. **翻译测试失败**
   ```
   BAIDU_TRANSLATE_APPID and BAIDU_TRANSLATE_SECRET not configured
   ```
   需要配置 `.env` 文件中的翻译API密钥。

3. **文件不存在错误**
   ```
   Error: ENOENT: no such file or directory
   ```
   确保配置文件（如 `original-manifest-list.json`）存在。

### 调试建议

1. 单独运行每个测试文件来定位问题
2. 检查控制台输出中的详细错误信息
3. 确保所有依赖的文件和模块都存在
4. 验证环境变量配置是否正确

## 添加新测试

创建新的测试文件时：

1. 文件名以 `.test.js` 结尾
2. 包含适当的测试用例和断言
3. 在 `run-tests.js` 中添加新文件到 `testFiles` 数组
4. 更新本 README 文件的说明
