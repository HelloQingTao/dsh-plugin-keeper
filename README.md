# dsh-plugin-keeper 插件运维台

DeepSeek Harness（DSH 0.2.x）的插件运维插件：把散落在 profile 里的插件信息收进一个设置页签，按安装来源分组盘点，并在后续版本提供检查更新与批量操作。

## 当前版本（0.1.0，M0）

设置页新增「插件运维 / Plugin Ops」页签：

- 按 **来源分组** 盘点当前 profile 的全部插件：官方插件、npm 插件、GitHub 插件、本地插件
- 每行展示：包名、版本、来源徽标（GitHub 显示 `user/repo`）、简述、运行状态（绿点 = 已启动）
- 官方插件灰显并标注「只读」，不参与后续批量操作
- 主题跟随宿主（仅用 `--dsw-alias-*` 语义 token），界面文案中英双语跟随宿主语言
- 全程只读：不写 profile 的任何文件

## 数据来源

- `~/.dsh/profiles/<profile>/package.json` 的 `dependencies`（依赖 spec 天然记录安装来源：npm 范围 / `github:` / `file:`）
- 每个包自身的 `package.json`（版本号与 `dsh` 元数据）
- 宿主 `profileContext.startedBundles`（当前实际启动的插件集合）

## 生效与验证

1. 安装：在 dsh CLI 里执行 `dsh plugin add dsh-plugin-keeper`（或本地路径），随后重启 dsh web / 桌面端（包内容变更需要进程重启才会生效）
2. 验证：打开 设置 → 「插件运维」页签，确认插件按来源分组展示、主题与语言跟随宿主

## Roadmap

- M1：一键检查更新（npm registry + GitHub releases，GitHub 支持检查与下载双通道代理）
- M2：多选批量更新 / 批量停用 / 批量卸载（装前快照、失败回滚、诚实结果台账；停用热生效，更新后提示重启）
- M3：GitHub 插件安装（直连或代理）；整合到官方插件管理页签的可选形态

## License

MIT
