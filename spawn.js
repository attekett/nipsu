
var spawn = require('child_process').spawn

/*
Create crash fingerprint out of ASAN-report.
<crash-type>-<frame #0>-<frame #1>-<frame #2>
*/
function asanFingerPrint (stderr) {
  if (stderr && stderr.indexOf('ERROR: AddressSanitizer') !== -1) {
    var asanTrace = stderr.replace('\n', '').replace(/\s+/g, ' ').split(' ')
    var fingerPrint = ''
    var frame = ''
    if (asanTrace.indexOf('AddressSanitizer:') !== -1) {
      fingerPrint += asanTrace[asanTrace.indexOf('AddressSanitizer:') + 1]
    }
    if (fingerPrint === 'stack-overflow') { return fingerPrint }
    asanTrace.splice(0, asanTrace.indexOf('AddressSanitizer:'))
    if (asanTrace.indexOf('#0') !== -1) {
      frame = asanTrace[asanTrace.indexOf('#0') + 1]
      fingerPrint += '-' + frame.substr(frame.length - 3, 3)
    }
    if (asanTrace.indexOf('#1') !== -1) {
      frame = asanTrace[asanTrace.indexOf('#1') + 1]
      fingerPrint += '-' + frame.substr(frame.length - 3, 3)
    }
    if (asanTrace.indexOf('#2') !== -1) {
      frame = asanTrace[asanTrace.indexOf('#2') + 1]
      fingerPrint += '-' + frame.substr(frame.length - 3, 3)
    }

    if (fingerPrint === '') { return null } else {
      return fingerPrint
    }
  } else {
    return null
  }
}

/*
Spawn target binary
*/
function spawnTarget (target, args, timeout) {
  var spawnedTarget = spawn(target, args)
  var stderr = ''

  function exitHandler (code) {
    /* emit crash: null or fingerprint */
    clearTimeout(spawnedTarget.timeout)
    spawnedTarget.emit('crash', asanFingerPrint(stderr))
  }

  spawnedTarget.stderr.on('data', function (data) {
    if (stderr !== '' || data.toString().indexOf('ERROR: AddressSanitizer') !== -1) {
      var newData = data.toString()
      stderr += newData
      clearTimeout(spawnedTarget.timeout)
      spawnedTarget.timeout = setTimeout(function () {
        spawnedTarget.kill('SIGKILL')
      }, 2000)
      if (newData.indexOf('==' + spawnedTarget.pid + '==ABORTING') !== -1) {
        clearTimeout(spawnedTarget.timeout)
        spawnedTarget.kill('SIGKILL')
      }
    }
  })
  spawnedTarget.on('exit', exitHandler)

  spawnedTarget.timeout = setTimeout(function () {
    spawnedTarget.removeListener('exit', exitHandler)
    spawnedTarget.on('exit', function () {
      spawnedTarget.emit('crash', null)
    })
    spawnedTarget.kill('SIGKILL')
  }, timeout)

  return spawnedTarget
}

module.exports = {
  spawnTarget: spawnTarget
}
