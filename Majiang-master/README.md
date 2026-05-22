<h1><a href="https://kobalab.net/majiang/"><img src="dist/img/logo.png" alt="电脑麻将" height=72></a></h1>

基于 HTML5 + JavaScript 运行的麻将应用「电脑麻将」。

<img src="dist/img/game.png" alt="游戏画面" width=480>

## 演示
https://kobalab.net/majiang/

## 许可证
[MIT](https://github.com/kobalab/Majiang/blob/master/LICENSE)

## 作者
[Satoshi Kobayashi](https://github.com/kobalab)

## npm scripts
| 命令           | 说明 |
|:---------------|:-----|
| `release`      | 构建发布版本。 |
| `build`        | 构建调试版本。 |
| `build:js`     | 仅构建 JavaScript 调试版本。 |
| `build:css`    | 仅构建 CSS。 |
| `build:html`   | 仅构建 HTML。 |

## 子包
本项目由以下子包组成：

### majiang-core
- GitHub: https://github.com/kobalab/majiang-core
- npm: @kobalab/majiang-core

提供手牌操作、向听数与和牌点数计算、对局推进、牌桌信息管理，以及思考例程基类等核心能力。

### majiang-ai
- GitHub: https://github.com/kobalab/majiang-ai
- npm: @kobalab/majiang-ai

提供麻将 AI 及其开发工具。AI 是 `majiang-core` 中 `Majiang.Player` 类的具体实现。

### majiang-ui
- GitHub: https://github.com/kobalab/majiang-ui
- npm: @kobalab/majiang-ui

提供手牌显示、牌桌显示、牌谱回放等 UI 与交互组件。

### tenhou-url-log
- GitHub: https://github.com/kobalab/tenhou-url-log
- npm: @kobalab/tenhou-url-log

提供将电脑麻将牌谱转换为网络麻将 [天凤](https://tenhou.net) JSON 牌谱格式的能力。

## 相关包
### majiang-server
- GitHub: https://github.com/kobalab/majiang-server
- npm: @kobalab/majiang-server

基于 WebSocket 的麻将服务器实现。电脑麻将的联网对战通过连接该服务器实现。

### majiang-analog
- GitHub: https://github.com/kobalab/majiang-analog
- npm: @kobalab/majiang-analog

牌谱解析工具，提供解析电脑麻将格式牌谱的基类，可通过继承该类编写分析程序。

### tenhou-log
- GitHub: https://github.com/kobalab/tenhou-log
- npm: @kobalab/tenhou-log

将网络麻将 [天凤](https://tenhou.net) 的牌谱转换为电脑麻将格式，可用于分析或回放。

## 书籍
<a href="https://www.amazon.co.jp/dp/4798067881"><img src="https://m.media-amazon.com/images/I/51DMflZaBNL._SL500_.jpg" title="对战型麻将游戏 AI 的算法与实现" height=240></a>

作者出版过一本讲解电脑麻将程序的书：[对战型麻将游戏 AI 的算法与实现](https://www.amazon.co.jp/dp/4798067881)。

## 致谢
游戏中使用的牌图素材来自 [麻将图片素材](http://www.civillink.net/fsozai/majan.html)，音效来自 [天凤用音效素材](http://ancoro.way-nifty.com/blog/se.html)。
