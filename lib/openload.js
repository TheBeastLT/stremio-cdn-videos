const needle = require('needle');

async function getOpenloadUrl(url) {
  return needle('get', url, { open_timeout: 1000})
      .then((response) => new Openload().downloadPage(response.body))
      .then((openload) => {
        openload.scrape();
        return openload.getUrl();
      })
}

// https://github.com/Poup2804/openload-url
class Openload {
  async downloadPage(body) {
    this.body = body;
    return this;
  }
  parsePage() {
    this._0x5d72cd = /<p .*?id="[\w]+".*?>([\w]{100,})<\/p>/.exec(this.body)[1];
    this.firstSet = /_1x4bfb36=parseInt\('(\d+)',8\)-(\d+)/.exec(this.body).slice(1,3);
    this.secondSet = /\(_0x30725e,\(parseInt\('(\d+)',8\)-(\d+)\+0x4-(\d+)\)\/\((\d+)-0x8\)\)/.exec(this.body).slice(1,5);
  }
  findID() {
    let _0x1bf6e5 = "";
    let _0x439a49 = this._0x5d72cd.substring(0, 9 * 8);
    let _0x31f4aa = {
      "k": _0x439a49,
      "ke": []
    };

    for (let i = 0; i < _0x439a49.length; i = i + 8) {
      let _0x40b427 = _0x439a49.substring(i, i + 8);
      let _0x577716 = parseInt(_0x40b427, 16);
      _0x31f4aa['ke'].push(_0x577716);
    }
    let _0x3d7b02 = _0x31f4aa["ke"];
    this._0x5d72cd = this._0x5d72cd.substring(9 * 8);
    _0x439a49 = 0;
    let _0x145894 = 0;
    while (_0x439a49 < this._0x5d72cd.length) {
      let _0x5eb93a = 0x40;
      let _0x896767 = 0;
      let _0x1a873b = 0;
      let _0x3d9c8e = 0;
      do {
        if (_0x439a49 + 1 >= this._0x5d72cd.length) {
          _0x5eb93a = 0x8f;
        }
        let _0x1fa71e = this._0x5d72cd.substring(_0x439a49, _0x439a49 + 2);
        _0x439a49 += 2;
        _0x3d9c8e = parseInt(_0x1fa71e, 16);
        let _0x332549 = _0x3d9c8e & 0x3f;
        if (_0x1a873b < 6 * 5) {
          _0x896767 += _0x332549 << _0x1a873b;
        } else {
          _0x896767 += _0x332549 * Math.pow(2, _0x1a873b);
        }
        _0x1a873b += 6;

      } while (_0x3d9c8e >= _0x5eb93a);
      let _1x4bfb36 = parseInt(this.firstSet[0], 8) - this.firstSet[1];
      let _0x30725e = _0x896767 ^ _0x3d7b02[_0x145894 % 9];
      _0x30725e = _0x30725e ^ (parseInt(this.secondSet[0], 8) - this.secondSet[1] + 0x4 - this.secondSet[2]) / (this.secondSet[3] - 0x8) ^ _1x4bfb36;
      let _0x2de433 = _0x5eb93a * 2 + 0x7f;
      for (let i = 0; i < 4; i++) {
        let _0x1a9381 = _0x30725e & _0x2de433;
        let _0x1a0e90 = 8 * i;
        _0x1a9381 = _0x1a9381 >> _0x1a0e90;
        let _0x3fa834 = String.fromCharCode(_0x1a9381 - 1);
        if (_0x3fa834 != '$') _0x1bf6e5 += _0x3fa834;
        _0x2de433 = _0x2de433 << 8;
      }
      _0x145894 += 1;
    }

    this.stream = _0x1bf6e5;
  }
  scrape() {
    this.parsePage();
    this.findID();
  }
  getUrl() {
    return "https://openload.co/stream/" + this.stream;
  }
}

module.exports = { getOpenloadUrl };
