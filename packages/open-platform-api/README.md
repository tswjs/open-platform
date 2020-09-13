# open-platform-api
Open api for https://tswjs.org

## Install

`yarn add @tswjs/open-platform-api`

## Usage

```js
const { OpenApi } = require("@tswjs/open-platform-api");

const client = new OpenApi({
  appid: "appid",
  appkey: "appkey"
});

/**
 * 从开放平台同步代理名单
 */
client.updateProxyEnvByCloud().then(d => {
  console.log(d);
}, e => {
  console.error(e);
});

/**
 * 获取测试环境列表
 * @param {String} group 测试环境分组，默认获取全部环境
 */
client.listTestEnv().then(d => {
  console.log(d);
}, e => {
  console.error(e);
});

/**
 * 添加白名单
 * @param {string} uin 白名单号码 e.g 12345
 * @param {string} val 环境列表，或者是 alpha 只染色 e.g 127.0.0.1:8080 或者 alpha
 */
client.addTestUid(uin, val).then(d => {
  console.log(d);
}, e => {
  console.error(e);
});

/**
 * 清除测试环境对应白名单号码
 * @param {String[]} uinList 白名单号码列表
 */
client.removeTestUid(uinList).then(d => {
  console.log(d);
}, e => {
  console.error(e);
});
```