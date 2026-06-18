# X2Rank

狼人杀本地积分榜 demo。当前版本是纯静态网页，可以直接部署到 GitHub Pages。

## 功能

- 提交单局积分记录：日期、局数、板子、角色、阵营、胜负、备注
- 支持两种计分方式：
  - 按暂定 0617 评分细则自动计算
  - 直接上传总分
- 自动生成排行榜：总分、胜率、局数、均分
- 最近提交记录可删除
- 数据暂存在浏览器 `localStorage`

## 本地打开

直接用浏览器打开 `index.html` 即可。

也可以启动一个简单静态服务器：

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
