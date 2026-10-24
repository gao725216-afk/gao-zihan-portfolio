# 高梓晗的作品集

六个项目介绍，以及 TT Suite、Orchard 与 Chatmate 的前端交互演示。

这是从原始作品集整理的静态发布版本。页面保留项目介绍；联系邮箱、演示讲解稿与面试准备材料不包含在本仓库中。

## 本地预览

在此目录运行可信的 Python 标准库服务，然后打开 `http://127.0.0.1:8765/`：

```sh
python -m http.server 8765 --bind 127.0.0.1
```

直接通过 HTTP 服务静态文件，无需安装依赖或执行构建脚本。演示数据为虚构数据，修改仅保存在当前浏览器；不提供真实支付、登录、云同步或 AI 服务。字体通过 Google Fonts 加载，网络不可用时使用系统字体。

## 文件与许可

- `index.html`：作品集入口。
- `demos/tt/`：TT Suite 前端演示及原包提供的 JavaScript 源文件。
- `demos/orchard/`：果园顾客端演示、源文件及图片。
- `demos/chatmate/`：Chatmate 页面设计与交互运行时。
- `demos/merchant/`：原包提供的商户后台已构建资产；原包未附其未构建源码工程。
- `demos/orchard/LICENSE-TDesign.txt`、`demos/orchard/LICENSE-Apache-2.0.txt` 与 `demos/tt/assets/garden/kenney-hexagon/license.txt` 保留原始许可内容。

第三方代码中的版权及许可声明保持原样；本仓库未为原作者作品追加其他许可授权。
