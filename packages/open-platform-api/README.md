# open-platform-api
Open api for https://tswjs.org

## Install

`yarn add @tswjs/open-platform-api`

## Usage

```javascript
const { OpenApi } = require("@tswjs/open-platform-api");

const client = new OpenApi({
  httpDomain: 'http',
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

‼️ 重要

2.0版本以后，不再允许将开放平台申请的 `appid` 和 `appkey` 通过参数的形式透传到插件中。业务可以选择用合适的方式将这两个参数挂载到环境变量当中，对应形式如下且环境变量的名称不可更改：

```
appid => process.env.APP_ID
appkey =>  process.env.APP_KEY
```
