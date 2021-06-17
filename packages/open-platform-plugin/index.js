const { OpenApi } = require('@tswjs/open-platform-api');
const ip = require("ip");
const net = require("net");

class OpenPlatformPlugin {
  /**
   * @param {Object} config 配置对象
   * @param {String} config.appid 应用 id
   * @param {String} config.appkey 应用 key
   * @param {"never" | "always" | "proxied"} config.reportStrategy 上报策略
   * @param {Function} config.getUid 获取用户唯一标识
   * @param {Function} config.getProxyInfo 获取本机代理环境信息
   * @param {Function} config.hooks.requestStart 请求开始前回调
   * @param {Function} config.hooks.responseFinish 结束开始前回调
   * @param {Boolean} httpDomain 是否使用 http 上报域名
   */
  constructor(config) {
    this.name = "OpenPlatformPlugin";
    this.reportStrategy = config.reportStrategy;
    this.reportStrategies = ["never", "always", "proxied"];
    this.proxyInfo = {};
    this.intranetIp = ip.address();

    this.openApi = new OpenApi({
      appid: config.appid,
      appkey: config.appkey,
      httpDomain: config.httpDomain
    })

    // 默认给一个返回 undefined 的同步函数
    this.getUid = config.getUid || (() => {});
    // 默认给一个返回 undefined 的同步函数re
    this.getProxyInfo = config.getProxyInfo || (() => {});
    // 回调函数
    this.hooks = config.hooks || {}
  }

  /**
   * 计算客户端实际ip
   */
  getUserIp(req) {
    let userIp = req.socket.remoteAddress;

    if (!userIp) {
      return '';
    }

    let xff = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    if (xff) {
      xff = xff.split(',')[0] || '';
      userIp = xff.trim() || userIp;
    } else if (realIp) {
      userIp = realIp;
    }

    // ipv4 in ipv6
    if (userIp.startsWith('::ffff:')) {
      return userIp.substr(7);
    }

    return userIp;
  }

  /**
   * 插件初始化
   */
  async init(eventBus, config) {
    this.log("插件开始加载...");

    this.log("获取 proxyInfo 中...");
    const info = await this.getProxyInfo();
    if (info) {
      this.proxyInfo[this.intranetIp] = info;
    }

    this.log("断言参数类型是否符合预期...");
    this.assertParams();

    this.log("上传 proxyInfo 中...");
    await this.reportProxyEnv();
    // 周期性上报代理环境
    setInterval(() => {
      this.log("上传代理环境到开放平台（间隔为 1min）...");
      this.reportProxyEnv();
    }, 60000);

    /**
     * 请求开始时，提取 uid
     */
    eventBus.on("REQUEST_START", (payload) => {
      if (typeof this.hooks.requestStart === 'function' && this.hooks.requestStart(payload) === false) {
        return
      }
      const { req, context } = payload;

      this.log(`${req.method} ${req.url}`);
      this.log(`server ip: ${this.intranetIp}, `
        + `tcp: ${(req.socket.remoteAddress)}:${(req.socket.remotePort)} `
        + `> ${(req.socket.localAddress)}:${(req.socket.localPort)}, client ip: ${this.getUserIp(req)}`);

      try{
        context.uid = this.getUid(req);
      } catch(e) {
        context.uid = null;
        this.log(`获取uid失败: ${e}`);
      }
      if(context.uid === null) {
        return;
      }
      // 1. 判断是否命中开放平台配置的代理名单
      for (const proxyIp of Object.keys(this.proxyInfo)) {
        const remoteAlphaList = this.proxyInfo[proxyIp].remoteAlphaList || [];
        if (remoteAlphaList.includes(context.uid) && proxyIp !== this.intranetIp) {
          context.proxyIp = proxyIp;
          context.proxyPort = this.proxyInfo[proxyIp].port || "80";
          break;
        }
      }
      // 2. 判断是否命中本地名单
      if (!net.isIP(context.proxyIp) 
        && this.proxyInfo[this.intranetIp]
        && this.proxyInfo[this.intranetIp].alphaList 
        && this.proxyInfo[this.intranetIp].alphaList.includes(context.uid)) {
        context.proxyIp = "alpha"; // 不转发，但抓包
      }
    })
    
    /**
     * 响应结束时，进行日志上报
     */
    eventBus.on("RESPONSE_FINISH", (payload) => {
      if (typeof this.hooks.responseFinish === 'function' && this.hooks.responseFinish(payload) === false) {
        return
      }
      const { req, res, context } = payload;

      switch (this.reportStrategy) {
        case "always":
          this.log(`请求结束日志上报，因为 reportStrategy 为 always`);
          return this.reportLog(req, res, context);
        case "never":
          this.log(`请求结束日志不上报，因为 reportStrategy 为 never`);
          return;
        case "proxied":
          if (context.proxyIp === "alpha") {
            this.log(`请求结束日志上报，因为这个请求用户 ${context.uid} 被染色了`);
            return this.reportLog(req, res, context);
          } else if (net.isIP(context.proxyIp)) {
            this.log(`请求结束日志上报，因为这个请求被代理到 ${context.proxyIp}`);
            return this.reportLog(req, res, context);
          } else {
            this.log(`请求结束日志不上报，因为这个请求没有被代理过`);
            return;
          }
      }
    })

    await this.updateProxyEnvByCloud();

    // 周期性更新代理名单
    setInterval(()=>{
      this.log("从开放平台同步测试号码（频率为 1min）...");
      this.updateProxyEnvByCloud();
    }, 60000);

    this.log("插件加载完毕")
  }

  assertParams() {
    if (this.reportStrategies.indexOf(this.reportStrategy) === -1) {
      throw new Error(`参数 reportStrategy 函数必须是为 ${this.reportStrategies} 其中一个`);
    }

    // TODO: 这里应该使用 joi 来进行更加详细的断言
    if (typeof this.proxyInfo !== "object") {
      throw new Error(`参数 getProxyInfo 函数必须返回一个对象`)
    }
  }

  /**
   * 上报代理环境
   */
  async reportProxyEnv() {
    const proxyInfo = this.proxyInfo[this.intranetIp];
  
    if (!proxyInfo) return this.log(`不允许通过代理访问本机器，不上报开放平台`);
    if (proxyInfo.alphaOnly) return this.log(`alphaOnly 参数为 true，不上报开放平台`);
  
    const logText = `${this.intranetIp}:${proxyInfo.port ? proxyInfo.port : '80'}`;
    let logJson = Object.assign({
      ip: this.intranetIp,
      port: proxyInfo.port || 80,
      time: new Date().toGMTString(),
      name: '',
      group: 'unknown',
      desc: '',
      order: 0,
      owner: '',
    }, proxyInfo);

    return this.openApi.reportProxyEnv({ 
      logText, 
      logJson 
    }).catch((e) => {
      this.log(`上报代理环境失败: ${e.message}`);
    });
  }

  /**
   * 从开放平台同步代理名单
   */
  async updateProxyEnvByCloud() {

    await this.openApi.updateProxyEnvByCloud().then(remoteProxyInfo => {
      const data = {};

      for(const uid of Object.keys(remoteProxyInfo)) {
        const [ip, port] = remoteProxyInfo[uid].split(":");

        if (data[ip]) {
          data[ip].remoteAlphaList.push(uid);
        } else {
          data[ip] = {
            remoteAlphaList: [uid],
            port: Number(port),
          };
        }
      }
      this.updateProxyInfo(data);
    }).catch(e => {
      this.log(`代理名单更新失败: ${e.message}`);
    })
  }

  updateProxyInfo(remoteProxyInfo) {
    for (const ip of Object.keys(this.proxyInfo)) {
      if (ip !== this.intranetIp) {
        delete this.proxyInfo[ip];
      }
    }

    for (const ip of Object.keys(remoteProxyInfo)) {
      if (this.proxyInfo[ip]) {
        this.proxyInfo[ip] = Object.assign(this.proxyInfo[ip], remoteProxyInfo[ip]);
      } else {
        this.proxyInfo[ip] = remoteProxyInfo[ip];
      }
    }
  }

  async reportLog(req, res, context) {
    const { captureRequests, currentRequest } = context;

    captureRequests.map(item => {
      // 适配一下，SN 需要以 1 开头，否则会丢失序号为 0 的抓包
      item.SN += 1;
      item.resultCode = item.statusCode;
      item.url = item.path;
    });
  
    currentRequest.resultCode = currentRequest.statusCode;
    currentRequest.url = currentRequest.path;
  
    const responseHeaders = (() => {
      const headers = {};
      res.getHeaderNames().forEach(name => {
        headers[name] = res.getHeader(name);
      })
      return headers;
    })();
  
    const logText = [].concat(context.log.arr)
      .concat(`\r\nresponse ${currentRequest.resultCode} ${
        JSON.stringify(responseHeaders, null, 4)
      }`);
  
    return this.openApi.reportLog({
      logText: logText.join("\r\n"),
      logJson: {
        curr: currentRequest,
        ajax: captureRequests
      },
      key: context.uid,
      ua: req.headers["user-agent"],
      userip: context.clientIp,
      host: context.host,
      pathname: req.url,
      statusCode: context.resultCode,
    }).catch(e => {
      this.log(`上报日志失败: ${e.message}`);
    });
  }

  log(string) {
    console.log(`[${this.name}]: ${string}`)
  }
}

module.exports = OpenPlatformPlugin;
