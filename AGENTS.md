# 项目说明

本项目是非官方 Google Trends Trending Now 采集库，使用 TypeScript 7 编写、Rslib 构建。只提供 npm SDK，不提供命令行；不得宣称使用谷歌官方公开接口，也不得将不完整的订阅数据当作榜单成功结果。

## 开发约定

- 开始任务前阅读仓库内的 [开发规范](docs/开发规范.md)，以下为本项目的补充约定。
- 代码注释和文档使用中文，保持简洁，只解释重点和特殊处理。
- 值与类型分别导入，类型使用 `import type`；使用声明式导出和目录下的 `index.ts` 桶导出。
- 按归属组织代码；模块内使用相对路径，跨模块通过 `@/` 别名引用公开入口。
- 类型放在 `types.ts`，常量放在 `constants.ts`；主流程在前，局部辅助函数后置。
- 包入口仅导出两个采集函数、错误类与错误码，以及四个核心业务类型；请求配置和字段辅助类型不单独对外导出。
- 公共库不得擅自打印、写业务库、定时执行或启动浏览器；手动验证脚本可以打印结果。
- 普通测试必须离线；真实请求只能通过显式的 `pnpm smoke` 执行。
- 发布只能走 `.github/workflows/release.yml`，由维护者推送 `v*` tag 或手动触发；不要在本机发布正式版。
- 不代打 tag、不代推送、不代触发发布、不修改原业务项目。
- 不恢复已移除的命令行或示例；除发布流水线外不新增自动化配置，文档目录仅保留通用开发规范。

## 目录

- `src/trending/`：趋势采集、参数校验和数据解析。
- `src/http/`：原生请求、超时和取消。
- `src/errors/`：公共错误类型。
- `src/index.ts`：公开接口。
- `test/`：核心离线测试。
- `scripts/check-package.ts`：发布文件、ESM/CJS 入口和类型声明验证，不重复业务测试。
- `scripts/smoke.ts`：手动真实接口验证。
- `.github/workflows/release.yml`：tag 触发的 npm 可信发布，发布前跑完整检查。
- `docs/开发规范.md`：仓库自带的通用开发规范，不依赖仓库外的本地文件。

## 发布

1. 在 `main` 上把 `package.json` 的版本号改成待发布版本并提交。
2. 推送同名 tag，例如 `git push origin v0.1.1`；tag 名必须是 `v` 加版本号，工作流会校验两者一致。
3. 工作流执行 `pnpm install` 后运行 `pnpm publish`，由 `prepublishOnly` 和 `prepack` 完成 lint、类型检查、测试、构建与 tarball 校验，再发布到 `latest`。
4. 预发布用 Actions 里的手动触发，版本号写成 `0.1.1-demo.0` 这类，dist-tag 选 `demo` 或 `next`。
5. 认证走 npm 可信发布：在 npm 包设置里配置 Trusted Publisher，指向本仓库和 workflow `release.yml`，不需要保存 `NPM_TOKEN`。
