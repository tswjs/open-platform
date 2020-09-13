# TSW 开放平台插件

## Install

`yarn add @tswjs/open-platform-plugin`

## Usage

在项目的 TSW 配置文件中，进行如下引用：

```js
const OpenPlatformPlugin = require("@tswjs/open-platform-plugin");

module.exports = {
  plugins: [
    new OpenPlatformPlugin({
      appid: "tsw1431",
      appkey: "PwPaD4RRAsrSdRZjQSc3fbKM",
      reportStrategy: "always",
      // 只支持同步写法
      getUid: (request) => {
        const cookie = request.headers.cookie;

        if (!cookie) return;

        const uid = /quid=([^;]*);?/g.exec(cookie);
        return uid ? uid[2] : '';
      },
      // 同步或者异步函数
      getProxyInfo: () => {
        return {
          "port": 80,
          "name": "2.0demo",
          "group": "TSW",
          "groupName": "TSW团队",
          "desc": "2.0demo测试环境",
          "order": 30,
          "owner": "demoUser",
          "alphaList": ["demoUser"]
        };
      }
    })
  ]
};
```

## Config

### `appid`

- `String`
- 必填

项目在 [TSW 开放平台](https://tswjs.org) 申请的应用 id。

### `appkey`

- `String`
- 必填

项目在 [TSW 开放平台](https://tswjs.org) 申请的应用 key。

### `reportStrategy`

- `"always" | "never" | "proxied"`
- 选填
- 默认值：`proxied`

`always`，表示在任何情况下都上报日志数据。
`never`，表示在任何情况下都不上报日志数据。
`proxied`，表示在被代理时上报数据。


### `getUid`

- `() => string` 同步函数
- 选填
- 默认值：`() => {}`

从每个请求中提取用户 uid

### `getProxyInfo`

- `Function` 同步或者异步函数
- 选填
- 默认值 `() => {}`

返回值如果为 `undefined`，表示这台机器不被允许通过代理到达。

否则需要返回一个对象，认为这台机器会被注册到开放平台上，可以通过在开放平台上配置代理到达。  

alphaList 表示本机希望抓包的用户列表。

```json
{
  "port": 80,
  "name": "2.0demo",
  "group": "TSW",
  "groupName": "TSW团队",
  "desc": "2.0demo测试环境",
  "order": 30,
  "owner": "demoUser",
  "alphaList": ["demoUser"]
}
```