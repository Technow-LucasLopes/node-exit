/**
 * Software distributed under the Apache License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either
 * express or implied. See the License for the specific language governing rights and limitations under the License.
 */

const assert = require('assert').ok
const {EventEmitter} = require('events')

let logger = null
try {
  logger = require('log4js').getLogger()
} catch (ex) {
  logger = console
  logger.fatal = console.error
}

/**
 * Gracefully shutdown a nodejs process
 */
class NodeExit extends EventEmitter {
  constructor() {
    super()

    this.signals = ['SIGINT', 'SIGTERM', 'unhandledRejection', 'uncaughtException']
    this._exitHandler = null
    this._isExiting = false

    process.once('exit', (code) => {
      if (code > 0) {
        logger.fatal(`Something went wrong, unexpected termination (code=${code})...`)
      }
    })
  }

  /**
   * Make sure the process will be terminated gracefully
   */
  registerExitHandler(handler) {
    assert(!this._exitHandler, `Allow only one exit handler, you can subscribe 'exit' event.`)

    this._exitHandler = handler
    this.signals.forEach((signal) => {
      process.on(signal, (err) => {
        if (signal.startsWith('SIG')) {
          err = undefined
        }
        return this._initiateNodeExit(signal, err)
      })
    })
  }

  async _initiateNodeExit(signal, err) {
    if (this._isExiting) {
      logger.fatal(`${signal} received twice. Signal handler seems not responding.`, err)
      return process.exit(1)
    }

    if (err) {
      logger.fatal(`Unexpected shutting down...`, err)
    } else {
      logger.warn(`${signal} received, shutting down...`)
    }

    let exitCode = err ? 1 : 0
    const isExpectedExit = exitCode === 0
    this.emit('exit', isExpectedExit)

    this._isExiting = true
    try {
      exitCode = (await this._exitHandler(isExpectedExit, err)) || exitCode
    } catch (ex) {
      logger.fatal(ex)
      exitCode = exitCode || 1
    }

    process.exit(exitCode)
  }
}

const singleton = new NodeExit()
module.exports = singleton
