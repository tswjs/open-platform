const crypto = require('crypto');

/**
 * 计算 open api 签名
 * @param {object} opt 签名数据
 * @param  {string} opt.method   请求方法  GET/POST
 * @param  {string} opt.pathname 请求路径
 * @param  {object} opt.data     请求数据
 * @param  {string} opt.appkey   应用appkey
 * @return {string} sig      签名结果
 */
const signature = (opt = {}) => {

  const queryArray = [];

  const busidataArr = [opt.method, encode(opt.pathname)]; // HTTP请求方式 & encode(uri) & encode(a=x&b=y&...)

  for (let i in opt.data) {
    if (typeof opt.data[i] !== 'undefined' && i !== 'sig') {
      queryArray.push(i + '=' + opt.data[i]);
    }
  }

  queryArray.sort((val1, val2) => {
    if (val1 > val2) {
      return 1;
    } else if (val1 < val2) {
      return -1;
    }
    return 0;
  });


  if (queryArray.length > 0) {
    busidataArr.push(encode(queryArray.join('&')));
  }

  return crypto.createHmac('sha1', opt.appkey + '&').update(busidataArr.join('&')).digest().toString('base64');
};

const encode = (str = '') => {
  let res = encodeURIComponent(str);

  // 0~9 a~z A~Z !*()
  // 不用考虑一位数了
  res = res.replace(/[^0-9a-zA-Z\-_.%]/g, ($0) =>
      '%' + $0.charCodeAt(0).toString(16).toUpperCase()
  );

  return res;
};

module.exports = {
  signature
}