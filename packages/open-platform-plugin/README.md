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
      },
      // 请求回调函数
      hooks: {
        // 请求开始前回调，返回 false 则提前返回
        requestStart(payload) {
          const { req, context } = payload
          if (req.method === 'HEAD') return false
        },
        // 结束开始前回调，返回 false 则提前返回
        responseFinish(payload) {
          const { req, context } = payload
          if (req.method === 'HEAD') return false
        },
      },
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

### `hooks.requestStart`

- `Function` 同步函数
- 选填

返回值如果为 `false`，则不做 uid 提取和匹配检查。

### `hooks.responseFinish`

- `Function` 同步函数
- 选填

返回值如果为 `false`，则跳过上报逻辑。

**如果返回一个对象，那么根据对象参数不同有几种情况：**

```json
{
  "port": 80,
  "name": "2.0demo",
  "group": "TSW",
  "groupName": "TSW团队",
  "desc": "2.0demo测试环境",
  "order": 30,
  "owner": "demoUser",
  "alphaOnly": false,
  "alphaList": ["demoUser"]
}
```

#### `alphaOnly`

- 默认为 `false`
- 若值为 `false`，认为这台机器会被注册到开放平台上，可以通过在开放平台上配置代理到达。
- 若值为 `true`，认为这台机器只是负责染色号码以记录日志。不可从开放平台配置代理。一般生产环境开启此参数。

#### `alphaList`

表示本机希望抓包的用户列表，值的比对对象是 `getUid` 方法返回值。

即 `alphaList.includes(getUid())`。
