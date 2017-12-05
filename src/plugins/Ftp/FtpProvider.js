'use strict'

const Provider = require('../../Provider')

require('whatwg-fetch')

/**
 * FTP Provider
 */
module.exports = class FtpProvider extends Provider {
  constructor (core, opts) {
    let newopts = Object.assign({ provider: 'ftp' }, opts)
    super(core, newopts)
  }

  // Get files from FTP service
  list (directory) {
    let headers = new Headers({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + this.opts.bearerToken
    })

    let request = new Request(this.opts.host + this.opts.getFilesUrl, {
      method: 'get',
      headers: headers
    })

    return fetch(request)
    .then(this.onReceiveResponse)
    .then((res) => {
      return res.json()
    })
  }

  checkAuth () {
    return this.list('').then(resp => {
      if (resp.Status === 'Error') {
        return false
      }
      return true
    })
  }
}
