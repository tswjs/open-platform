const fetch = require("node-fetch");
const URL = require("url");
const { signature } = require("./sig");
const { encode } = require("./encrypt");

/**
 * tswjs开放平台openapi接口封装 
 */
class OpenApi {
  /**
   * 调用openapi依赖的参数
   * @param {*} options 参数对象
   * @param {string} options.appid 应用 id
   * @param {string} options.appkey 应用 key
   * @param {string} options.httpDomain 是否使用 http 上报域名
   */
  constructor(options = {}) {
    this.apiDomain = "openapi.tswjs.org";
    this.appid = options.appid
    this.appkey = options.appkey;
    this.apiPrefix = `${options.httpDomain ? "http" : "https"}://${this.apiDomain}`;

    this.logReportUrl = `${this.apiPrefix}/v1/log/report`;
    this.h5testSyncUrl = `${this.apiPrefix}/v1/h5test/sync`;
    this.h5testListUrl = `${this.apiPrefix}/openapi/h5test/list`;
    this.h5testSetUrl = `${this.apiPrefix}/openapi/h5test/set`;

    if (!this.appid) {
      throw new Error(`参数 appid 不能为空`);
    }

    if (!this.appkey) {
      throw new Error(`参数 appkey 不能为空`)
    }
    
    this.handleProxy();
  }

  handleProxy() {
    if ((process.env.no_proxy || "").includes(this.apiDomain)
    || (process.env.NO_PROXY || "").includes(this.apiDomain)) {
      return;
    }
  
    if ((process.env.http_proxy || "").includes("127.0.0.1:12759")
    || (process.env.HTTP_PROXY || "").includes("127.0.0.1:12759")
    || (process.env.http_proxy || "").includes("127.0.0.1:12639")
    || (process.env.HTTP_PROXY || "").includes("127.0.0.1:12639")) {
      process.env.no_proxy = process.env.no_proxy 
        ? `${process.env.no_proxy},${this.apiDomain}`
        : this.apiDomain;
    }
  }

  /**
   * 从开放平台同步代理名单
   */
  async updateProxyEnvByCloud() {
    const data = {
      appid: this.appid,
      now: Date.now()
    };

    data.sig = signature({
      pathname: URL.parse(this.h5testSyncUrl).pathname,
      method: "POST",
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.h5testSyncUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }
  /**
   * 获取测试环境列表
   * @param {String} group 测试环境分组，默认获取全部环境
   */
  async listTestEnv(group) {
    const data = {
      appid: this.appid,
      now: Date.now()
    };

    if (group) {
      data.group = group
    }

    data.sig = signature({
      pathname: URL.parse(this.h5testListUrl).pathname,
      method: "POST",
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.h5testListUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }
  /**
   * 添加白名单
   * @param {string} uin 白名单号码 e.g 12345
   * @param {string} val 环境列表，或者是 alpha 只染色 e.g 127.0.0.1:8080 或者 alpha
   */
  async addTestUid(uin, val) {
    const data = {
      appid: this.appid,
      action: 'add',
      uin,
      val,
      now: Date.now()
    };

    data.sig = signature({
      pathname: URL.parse(this.h5testSetUrl).pathname,
      method: "POST",
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.h5testSetUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }

  /**
   * 清除测试环境对应白名单号码
   * @param {String[]} uinList 白名单号码列表
   */
  async removeTestUid(uinList) {
    const data = {
      appid: this.appid,
      action: 'del',
      uin: uinList.join(','),
      now: Date.now()
    };

    data.sig = signature({
      pathname: URL.parse(this.h5testSetUrl).pathname,
      method: "POST",
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.h5testSetUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }

  /**
   * 上报代理环境
   * @param {*} info 
   */
  async reportProxyEnv(info) {
    const { logText, logJson } = info;

    if (!logText) {
      throw new Error("logText 参数不可以为空");
    }

    if (!logJson) {
      throw new Error("logJson 参数不可以为空");
    }

    const data = {
      type: 'alpha',
      logText: encode(this.appid, this.appkey, logText),
      logJson: encode(this.appid, this.appkey, logJson),
      key: 'h5test',
      group: 'tsw',
      mod_act: 'h5test',
      ua: '',
      userip: '',
      host: '',
      pathname: '',
      statusCode: '',
      appid: this.appid,
      appkey: this.appkey,
      now: Date.now(),
    };

    data.sig = signature({
      pathname: URL.parse(this.logReportUrl).pathname,
      method: 'POST',
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.logReportUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }

  /**
   * 上报日志
   */
  async reportLog(info) {
    const { logText, logJson, key, ua, userip, host, pathname, statusCode} = info;

    const data = {
      type: "alpha",
      appid: this.appid,
      appkey: this.appkey,
      now: Date.now(),
  
      logText: encode(this.appid, this.appkey, logText),
      logJson: encode(this.appid, this.appkey, logJson),
  
      key,
      mod_act: "",
      ua,
      userip,
      host,
      pathname,
      ext_info: '',
      statusCode,
      group: ""
    };

    data.sig = signature({
      pathname: URL.parse(this.logReportUrl).pathname,
      method: 'POST',
      data,
      appkey: this.appkey
    });

    const res = await fetch(this.logReportUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }
}

module.exports = {
  OpenApi
}
