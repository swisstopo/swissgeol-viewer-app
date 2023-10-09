// Karma Edge Launcher
// =================

// Dependencies
// ------------

var exec = require('child_process').exec

// Constructor
function EdgeBrowser (baseBrowserDecorator, logger) {
  baseBrowserDecorator(this)

  var log = logger.create('launcher')

  function killEdgeProcess (cb) {
    exec('taskkill /t /f /im MicrosoftEdge.exe', function (err) {
      if (err) {
        log.error('Killing Edge process failed. ' + err)
      } else {
        log.debug('Killed Edge process')
      }
      cb()
    })
  }

  this._getOptions = function (url) {
    return [url, '-k']
  }

  var baseOnProcessExit = this._onProcessExit
  this._onProcessExit = function (code, errorOutput) {
    killEdgeProcess(function () {
      if (baseOnProcessExit) {
        baseOnProcessExit(code, errorOutput)
      }
    })
  }
}

EdgeBrowser.prototype = {
  name: 'Edge',
  DEFAULT_CMD: {
    win32: require.resolve('edge-launcher/dist/x86/MicrosoftEdgeLauncher.exe')
  },
  ENV_CMD: 'EDGE_BIN'
}

EdgeBrowser.$inject = ['baseBrowserDecorator', 'logger']

// Publish di module
// -----------------

module.exports = {
  'launcher:Edge': ['type', EdgeBrowser]
}
