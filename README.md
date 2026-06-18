# X2Rank

狼人杀本地积分榜 demo。当前版本是纯静态网页，可以直接部署到 GitHub Pages。

## 功能

- 提交单局积分记录：日期、局数、板子、角色、阵营、胜负、备注
- 支持两种计分方式：
  - 按暂定 0617 评分细则自动计算
  - 直接上传总分
- 自动生成排行榜：总分、胜率、局数、均分
- 最近提交记录可删除
- 服务器模式下数据保存到 `data/store.json`；静态预览模式下暂存在浏览器 `localStorage`

## 服务器部署

推荐在学校服务器上用 Node 启动，这样所有战绩、评论、密码都会保存到服务器本地的 `data/store.json`。

一键后台启动：

```bash
chmod +x start.sh
./start.sh
```

常用命令：

```bash
./start.sh status
./start.sh restart
./start.sh stop
./start.sh logs
```

指定端口：

```bash
PORT=80 ./start.sh
```

前台启动：

```bash
npm start
```

默认端口是 `5174`。也可以指定端口：

```bash
PORT=80 npm start
```

同一校园网内访问：

```text
http://服务器IP:5174/
```

## 静态预览

直接用浏览器打开 `index.html` 也可以预览，但数据只会保存在当前浏览器里，不会多人同步。

也可以启动一个简单静态服务器预览：

```bash
python3 -m http.server 5173
```

然后访问：

```text
http://localhost:5173
```

## 部署到 GitHub Pages

1. 推送到 GitHub 仓库 `Jozky86/X2Rank`
2. 打开仓库 Settings -> Pages
3. Source 选择 `Deploy from a branch`
4. Branch 选择 `main`，目录选择 `/root`
5. 保存后等待 GitHub Pages 构建完成

如果后续绑定阿里云域名，可以在 Pages 设置里填入自定义域名，并在阿里云 DNS 里添加 GitHub Pages 要求的解析记录。

## 后续计划

- 接入真实账号密码登录
- 从本地存储切换到数据库
- 支持多人在线提交和管理员审核
- 扩展更细的狼人杀评分规则
- 增加赛季、玩家详情页、导入历史数据
