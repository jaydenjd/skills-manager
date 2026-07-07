# Apple 签名与公证配置说明

这份文档记录 Skill Manager 的 macOS Developer ID 签名、Apple 公证、本地构建验证，以及 GitHub Actions 自动构建发布的完整配置过程。

请不要把 `.p12`、`.p8`、`.env`、密码、GitHub token、base64 原文等敏感内容提交到仓库。

## 目标

macOS 应用如果不通过 App Store 分发，需要完成两件事：

- **代码签名**：使用 Developer ID Application 证书签名 `Skill Manager.app` 和 `.dmg`。
- **Apple 公证**：把签名后的 App 或 DMG 上传给 Apple 审核，审核通过后把公证票据 staple 到文件上。

配置完成后，其他电脑下载 DMG 安装时，通常不会再出现“应用已损坏”或 Gatekeeper 无法打开的问题。

## 当前项目配置

项目使用：

- `electron-builder`
- `@electron/notarize`
- GitHub Actions

相关文件：

- `package.json`
  - `build.mac.hardenedRuntime: true`
  - `build.mac.entitlements: build/entitlements.mac.plist`
  - `build.afterSign: build/notarize.cjs`
  - `build.afterAllArtifactBuild: build/notarize-dmg.cjs`
  - `scripts.dist:mac:signed`
- `build/notarize.cjs`
  - App 签名后，对 `.app` 做 Apple 公证。
- `build/notarize-dmg.cjs`
  - 对 `.dmg` 做签名、公证和 staple。
- `.github/workflows/build.yml`
  - 构建 macOS arm64、macOS x64、Windows x64。
  - 上传构建产物。
  - 当推送 `v*` tag 时自动发布 GitHub Release。

## Apple 侧准备

需要准备：

- Apple Developer Program 账号。
- **Developer ID Application** 证书。
- App Store Connect API Key，用于公证。

官方参考：

- Apple Developer Program 注册说明：[Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- 通过 Apple Developer app 注册：[Enrolling in the Apple Developer app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/)
- 创建 CSR：[Create a certificate signing request](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/)
- 创建 Developer ID 证书：[Create Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- App Store Connect API Key：[App Store Connect API](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)

### 1. 准备 Apple Developer Program 账号

Apple Developer Program 是签发 Developer ID Application 证书和访问 App Store Connect 的前提。个人开发者和组织都可以注册。

注册前确认：

- 有一个可正常登录的 Apple Account。
- Apple Account 已开启双重认证。
- 账号持有人达到所在地区的法定成年年龄。
- 如果以组织身份注册，需要有代表组织签署协议的权限。

注册方式：

1. 打开 [Apple Developer Program 注册页](https://developer.apple.com/programs/enroll/)。
2. 选择个人或组织身份。
3. 按页面提示完成身份信息、联系方式、付款和协议确认。
4. 注册完成后，使用同一个 Apple Account 登录 [Apple Developer](https://developer.apple.com/account/)。
5. 确认可以访问 **Certificates, Identifiers & Profiles**。
6. 登录 [App Store Connect](https://appstoreconnect.apple.com/)，确认可以进入 **Users and Access**。

如果使用手机端 Apple Developer app 注册：

1. 在 iPhone、iPad 或 Mac 安装 Apple Developer app。
2. 登录要用于开发者账号的 Apple Account。
3. 在 Account 或 Enrollment 入口开始注册。
4. 按提示完成身份验证、付款和协议。
5. 注册通过后，再回到网页端 Apple Developer 和 App Store Connect 完成证书/API Key 配置。

注意：

- Developer ID 证书通常需要 Account Holder 或 Admin 权限。
- 如果是组织账号，普通成员可能看不到证书创建入口，需要管理员授权。
- 账号过期后，已签名且已公证的旧版本通常仍可运行，但无法继续签名新版本或更新版本。

### 2. 创建 Developer ID Application 证书

Developer ID Application 证书用于签名在 Mac App Store 之外分发的 macOS 应用。这个项目的 DMG 发布方式需要这个证书。

#### 2.1 创建 CSR 文件

先在本机生成 CSR：

1. 打开 macOS 的 **钥匙串访问**。
2. 菜单选择 **钥匙串访问 > 证书助理 > 从证书颁发机构请求证书**。
3. 填写：
   - **用户电子邮件地址**：你的开发者账号邮箱。
   - **常用名称**：建议写容易识别的名字，例如 `Skill Manager Developer ID`。
   - **CA 电子邮件地址**：留空。
4. 选择 **存储到磁盘**。
5. 保存生成的 `.certSigningRequest` 文件。

也可以用命令行生成 CSR，但钥匙串方式最直观，且会自动在本机保存对应私钥。

#### 2.2 在 Apple Developer 后台创建证书

1. 打开 [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list)。
2. 进入 **Certificates**。
3. 点击左上角 `+`。
4. 在证书类型里选择 **Developer ID Application**。
5. 上传刚才生成的 `.certSigningRequest` 文件。
6. 点击 Continue / Generate。
7. 下载生成的 `.cer` 证书文件。
8. 双击 `.cer` 安装到本机钥匙串。

安装完成后，用下面命令确认：

```bash
security find-identity -v -p codesigning
```

预期能看到类似：

```text
1) <SHA1> "Developer ID Application: <NAME> (<TEAM_ID>)"
   1 valid identities found
```

#### 2.3 导出 `.p12`

GitHub Actions 不能直接访问本机钥匙串，所以需要把证书和私钥导出为 `.p12`：

1. 打开 **钥匙串访问**。
2. 找到刚安装的 **Developer ID Application** 证书。
3. 展开证书，确认下面有对应私钥。
4. 选中证书和私钥，右键选择 **导出**。
5. 文件格式选择 `.p12`。
6. 设置导出密码。
7. 保存到安全目录。

这个 `.p12` 后续会转成 `MAC_CERTIFICATE_BASE64`；导出密码后续会配置为 `MAC_CERTIFICATE_PASSWORD`。

可以用下面命令验证 `.p12` 文件和密码是否正确：

```bash
openssl pkcs12 -info -in /path/to/SkillManager_DeveloperIDApplication.p12 -noout
```

如果密码正确，会看到 OpenSSL 提示 MAC 校验通过。

如果导出时没有 `.p12` 选项，通常说明：

- 当前钥匙串里没有对应私钥。
- CSR 不是在这台机器上生成的。
- 只安装了 `.cer`，没有私钥。

解决方式是回到生成 CSR 的那台 Mac 导出，或者重新在当前 Mac 生成 CSR 并重新创建证书。

### 3. 创建 App Store Connect API Key

App Store Connect API Key 用于 `notarytool` 在 CI 环境里向 Apple 提交公证请求。

推荐使用 **Team API Key**，适合 GitHub Actions 这种团队级 CI。

创建步骤：

1. 打开 [App Store Connect](https://appstoreconnect.apple.com/)。
2. 进入 **Users and Access**。
3. 切换到 **Integrations**。
4. 默认会进入 **App Store Connect API**。
5. 选择 **Team Keys**。
6. 点击 **Generate API Key**，如果已有 key，则点击 `+`。
7. 输入一个便于识别的名字，例如 `Skill Manager Notarization`。
8. 选择访问权限。用于公证时，通常使用 Account Holder/Admin 创建的 Team Key。
9. 点击 Generate。
10. 下载 `.p8` 文件。

创建后需要记录三项信息：

| 信息 | 用途 |
| --- | --- |
| Key ID | 配置为 `APPLE_API_KEY_ID` |
| Issuer ID | 配置为 `APPLE_API_ISSUER` |
| `.p8` 文件 | base64 后配置为 `APPLE_API_KEY_BASE64` |

注意：

- `.p8` 私钥通常只能下载一次，下载后要安全保存。
- 如果 `.p8` 丢失，不能重新下载，只能 revoke 后重新创建。
- 如果 key 泄露，应立即 revoke 并更新 GitHub Actions secrets。

#### 3.1 本地测试 API Key

可以先把 API Key 存成本地 notary profile：

```bash
xcrun notarytool store-credentials "skill-manager-notary" \
  --key /path/to/AuthKey_<KEY_ID>.p8 \
  --key-id <APPLE_API_KEY_ID> \
  --issuer <APPLE_API_ISSUER>
```

如果命令成功，说明 Key ID、Issuer ID 和 `.p8` 能被 `notarytool` 正常识别。

#### 3.2 转换成 GitHub Actions secrets

`.p8` 文件需要转换成 base64：

```bash
base64 -i /path/to/AuthKey_<KEY_ID>.p8 | pbcopy
```

然后写入 GitHub secret：

```bash
gh secret set APPLE_API_KEY_BASE64 --repo jaydenjd/skills-manager
gh secret set APPLE_API_KEY_ID --repo jaydenjd/skills-manager
gh secret set APPLE_API_ISSUER --repo jaydenjd/skills-manager
```

## 配置本地公证 Profile

本地可以把 App Store Connect API Key 存到 notarytool profile：

```bash
xcrun notarytool store-credentials "skill-manager-notary" \
  --key /path/to/AuthKey_<KEY_ID>.p8 \
  --key-id <APPLE_API_KEY_ID> \
  --issuer <APPLE_API_ISSUER>
```

然后执行本地签名和公证构建：

```bash
npm run dist:mac:signed
```

这个脚本会使用：

```bash
CSC_NAME="JUNDE WU (A8DZ968K75)"
APPLE_NOTARY_KEYCHAIN_PROFILE="skill-manager-notary"
```

## 本地验证

构建完成后，可以验证 `.app`：

```bash
spctl --assess --type execute --verbose=4 "release/mac-arm64/Skill Manager.app"
```

验证 `.dmg`：

```bash
spctl --assess --type open --context context:primary-signature --verbose=4 "release/Skill Manager-0.1.8-arm64.dmg"
```

成功时通常会看到：

```text
accepted
source=Notarized Developer ID
```

也可以检查签名详情：

```bash
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Skill Manager.app"
codesign --display --verbose=4 "release/mac-arm64/Skill Manager.app"
```

## GitHub Actions Secrets

GitHub Actions 无法访问你本机的 Keychain，所以需要把证书和 API Key 配置为仓库 secrets。

需要配置 6 个 secrets：

| Secret | 说明 |
| --- | --- |
| `MAC_CERTIFICATE_BASE64` | Developer ID Application `.p12` 文件的 base64 内容 |
| `MAC_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `KEYCHAIN_PASSWORD` | GitHub Actions 临时 Keychain 的密码 |
| `APPLE_API_KEY_BASE64` | App Store Connect `.p8` 文件的 base64 内容 |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID |
| `APPLE_API_ISSUER` | App Store Connect Issuer ID |

在 macOS 上生成 `.p12` 的 base64：

```bash
base64 -i /path/to/SkillManager_DeveloperIDApplication.p12 | pbcopy
```

生成 `.p8` 的 base64：

```bash
base64 -i /path/to/AuthKey_<KEY_ID>.p8 | pbcopy
```

使用 GitHub CLI 设置 secrets：

```bash
gh auth login
gh secret set MAC_CERTIFICATE_BASE64 --repo jaydenjd/skills-manager
gh secret set MAC_CERTIFICATE_PASSWORD --repo jaydenjd/skills-manager
gh secret set KEYCHAIN_PASSWORD --repo jaydenjd/skills-manager
gh secret set APPLE_API_KEY_BASE64 --repo jaydenjd/skills-manager
gh secret set APPLE_API_KEY_ID --repo jaydenjd/skills-manager
gh secret set APPLE_API_ISSUER --repo jaydenjd/skills-manager
```

也可以先写入一个本地 dotenv 文件，再一次性导入：

```bash
gh secret set --repo jaydenjd/skills-manager --env-file /path/to/skill-manager-github-actions-secrets.env
```

dotenv 文件格式如下：

```dotenv
MAC_CERTIFICATE_BASE64=<base64 p12>
MAC_CERTIFICATE_PASSWORD=<p12 export password>
KEYCHAIN_PASSWORD=<temporary ci keychain password>
APPLE_API_KEY_BASE64=<base64 p8>
APPLE_API_KEY_ID=<key id>
APPLE_API_ISSUER=<issuer id>
```

确认 secrets 是否存在，不会输出具体值：

```bash
gh secret list --repo jaydenjd/skills-manager
```

## GitHub Actions 构建流程

`.github/workflows/build.yml` 里，非 PR 构建会执行签名和公证。

macOS job 的主要流程：

1. 把 `MAC_CERTIFICATE_BASE64` 解码成临时 `.p12` 文件。
2. 创建临时 Keychain。
3. 使用 `MAC_CERTIFICATE_PASSWORD` 导入 `.p12`。
4. 把 `APPLE_API_KEY_BASE64` 解码成 `AuthKey.p8`。
5. 构建 macOS 安装包：

```bash
npm run build && npx electron-builder --mac dmg --arm64 --publish never
npm run build && npx electron-builder --mac dmg --x64 --publish never
```

6. `electron-builder` 对 App 做签名。
7. `build/notarize.cjs` 对 `.app` 做公证。
8. `build/notarize-dmg.cjs` 对 `.dmg` 做签名、公证和 staple。
9. 上传构建产物。

当推送 `v*` tag 时，release job 会下载所有构建产物，并发布 GitHub Release。

## 触发 Release

创建并推送 tag：

```bash
git tag -a v0.1.9 -m "Release v0.1.9"
git push origin master --follow-tags
```

如果 GitHub SSH 22 端口不可用，可以走 443 端口：

```bash
ssh-keyscan -p 443 ssh.github.com >> ~/.ssh/known_hosts
git push ssh://git@ssh.github.com:443/jaydenjd/skills-manager.git master --follow-tags
```

查看 workflow：

```bash
gh run list --repo jaydenjd/skills-manager --workflow "Build Installers" --limit 5
gh run watch <run-id> --repo jaydenjd/skills-manager --exit-status
```

查看失败日志：

```bash
gh run view <run-id> --repo jaydenjd/skills-manager --log-failed
```

## 本次成功验证记录

这次配置验证使用的 tag：

```text
v0.1.8-signing-test.4
```

对应 GitHub Actions run：

```text
28842263099
```

成功的 job：

```text
macOS arm64
macOS x64
Windows x64
Publish GitHub Release
```

Release 产物：

```text
Skill.Manager-0.1.8-arm64.dmg
Skill.Manager-0.1.8.dmg
Skill.Manager.Setup.0.1.8.exe
```

关键成功信号：

- `Import Apple signing certificate` 通过。
- `Write Apple notarization key` 通过。
- `Build signed and notarized macOS installer` 通过。
- macOS arm64 和 macOS x64 都成功上传 artifact。
- GitHub Release 成功发布。

## 常见问题

### GitHub Actions 提示 secrets 缺失

典型日志：

```text
Missing macOS signing secrets.
MAC_CERTIFICATE_BASE64:
MAC_CERTIFICATE_PASSWORD:
KEYCHAIN_PASSWORD:
```

原因通常是：

- 没有在仓库里配置对应的 **Actions secrets**。
- 配成了 Variables，而不是 Secrets。
- secret 名字拼错。

检查：

```bash
gh secret list --repo jaydenjd/skills-manager
```

重新写入：

```bash
gh secret set --repo jaydenjd/skills-manager --env-file /path/to/secrets.env
```

### `security import` 失败

常见原因：

- `.p12` 密码不正确。
- base64 编码的不是正确的 `.p12` 文件。
- 复制 base64 时被截断。

本地先验证：

```bash
openssl pkcs12 -info -in /path/to/certificate.p12 -noout
```

### 本地能公证，GitHub Actions 不能公证

重点检查：

- `APPLE_API_KEY_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

同时确认 App Store Connect 里的 API Key 仍然有效。

### 下载后仍然提示无法打开或已损坏

先验证下载到本地的 DMG：

```bash
spctl --assess --type open --context context:primary-signature --verbose=4 "/path/to/Skill Manager.dmg"
```

预期：

```text
accepted
source=Notarized Developer ID
```

如果不是这个结果，确认下载的 release asset 是否是在签名 secrets 配置完成后构建出来的。

### 测试 tag 也发布了 Release

当前 workflow 对所有 `v*` tag 都会发布 Release，所以类似 `v0.1.8-signing-test.4` 也会触发真实发布。

后续可以选择：

- 验证后手动删除测试 Release。
- 测试 tag 不使用 `v*` 前缀。
- 调整 workflow，只允许正式版本 tag 发布 Release。
- 增加 `workflow_dispatch` 参数，用手动开关控制是否发布 Release。

## 证书和 API Key 轮换

如果 Developer ID Application 证书过期或更换：

1. 在本机安装新证书。
2. 重新导出 `.p12`。
3. 更新 `MAC_CERTIFICATE_BASE64`。
4. 更新 `MAC_CERTIFICATE_PASSWORD`。
5. 确认 `package.json` 里的 `build.mac.identity` 仍然匹配。
6. 推送一个验证 tag，确认 macOS job 成功。

如果 App Store Connect API Key 轮换：

1. 下载新的 `.p8`。
2. 更新 `APPLE_API_KEY_BASE64`。
3. 更新 `APPLE_API_KEY_ID`。
4. 如果 Issuer 变化，更新 `APPLE_API_ISSUER`。
5. 本地重新创建 notary profile：

```bash
xcrun notarytool store-credentials "skill-manager-notary" \
  --key /path/to/AuthKey_<KEY_ID>.p8 \
  --key-id <APPLE_API_KEY_ID> \
  --issuer <APPLE_API_ISSUER>
```
