const path = require('path');
const fetch = require("node-fetch");
const URL = require("url");
const { signature } = require("./sig");
const { encode } = require("./encrypt");
const getProxyForUrl = require('proxy-from-env').getProxyForUrl;
const HttpsProxyAgent = require('https-proxy-agent');
const HttpProxyAgent = require('http-proxy-agent');

/**
 * tswjs开放平台openapi接口封装
 */
class OpenApi {
  /**
   * 调用openapi依赖的参数
   * @param {*} options 参数对象
   * @param {boolean} options.httpDomain 是否使用 http 上报, 用于调试或者内部通道，正常都走https
   * @param {number} options.fetchOpenPlatformTimeout 请求开放平台的超时时间，默认为 3000 ms
   */
  constructor(options = {}) {
    this.apiDomain = "openapi.tswjs.org";
    this.appid = options.appid || process.env.APP_ID;
    this.appkey = options.appkey || process.env.APP_KEY;
    this.apiPrefix = `${options.httpDomain ? "http" : "https"}://${this.apiDomain}`;
    this.fetchOpenPlatformTimeout = options.fetchOpenPlatformTimeout || 3000;

    this.logReportUrl = `${this.apiPrefix}/v2/log/report`;
    this.h5testSyncUrl = `${this.apiPrefix}/v1/h5test/sync`;
    this.h5testListUrl = `${this.apiPrefix}/openapi/h5test/list`;
    this.h5testSetUrl = `${this.apiPrefix}/openapi/h5test/set`;

    const proxyUrl = getProxyForUrl(this.apiPrefix);

    if (proxyUrl) {
      if (options.httpDomain) {
        this.agent = new HttpProxyAgent(proxyUrl);
      } else {
        this.agent = new HttpsProxyAgent(proxyUrl);
      } 
    }

    if (!this.appid) {
      throw new Error(`参数 appid 不能为空`);
    }

    if (!this.appkey) {
      throw new Error(`参数 appkey 不能为空`)
    }
  }

  async fetchWithTimeout(url, payload = {}) {
    const timeout = this.fetchOpenPlatformTimeout;
    let timer;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(-1);
      }, timeout);
    });

    const res = await Promise.race([timeoutPromise, fetch(url, payload)]);
    if(res === -1) throw new Error(`fetch-timeout: ${url}`);
    clearTimeout(timer);
    return res;
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

    const res = await this.fetchWithTimeout(this.h5testSyncUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
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

    const res = await this.fetchWithTimeout(this.h5testListUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
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

    const res = await this.fetchWithTimeout(this.h5testSetUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
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

    const res = await this.fetchWithTimeout(this.h5testSetUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
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

    const res = await this.fetchWithTimeout(this.logReportUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }

  fingureGroup(reqHeaders, resHeaders, pathname = '') {
    const contentType = resHeaders['content-type'] || '';
    const ext = path.extname(pathname).toLowerCase();

    if (!contentType) {
      // 没声明算html
      return 'html';
    }
    if (/^text\/html/.test(contentType)) {
      return 'html';
    }
    if (contentType === 'websocket') {
      return websocket;
    }
    if (reqHeaders['x-requested-with'] === 'XMLHttpRequest') {
      return 'XHR';
    }
    if (/^text\/javascript/.test(contentType)) {
      return 'js';
    }
    if (/^image\/.*/.test(contentType)) {
      return 'image';
    }
    if (['.json', '.cgi', '.fcg', '.php'].includes(ext)) {
      return 'XHR';
    }
    if (['.eot', '.svg', '.ttf', '.woff'].includes(ext)) {
      return 'font';
    }
    // 其余的通过后缀区分吧
    if (!ext) {
      return '';
    } else {
      // 一些特殊后缀的映射
      return {
        gif: 'image',
        xml: 'xml',
        map: 'js',
        // 有些js返回头不一样还是要根据后缀来
        js: 'js'
      }[ext] || '';
    }
  }

  /**
   * 上报日志
   */
  async reportLog(info) {
    const {
      logText, logJson, key, userip,
      host, pathname, statusCode, ua,
      reqHeaders = {}, resHeaders = {},
    } = info;

    if (!key) return;

    const group = this.fingureGroup(reqHeaders, resHeaders, pathname);

    const data = {
      type: "alpha",
      appid: this.appid,
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
      group,
    };

    data.sig = signature({
      pathname: URL.parse(this.logReportUrl).pathname,
      method: 'POST',
      data,
      appkey: this.appkey
    });

    const res = await this.fetchWithTimeout(this.logReportUrl, {
      method: "post",
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'},
      agent: this.agent,
    });

    const { code, msg, data: resData } = await res.json();

    if (code !== 0) throw new Error(msg);

    return resData;
  }
}

module.exports = {
  OpenApi
}
