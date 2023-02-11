const TIMESTAMP_COLUMN = 4;


/**
 * @typedef {Object} Host
 * @property {number} row
 * @property {string} name
 * @property {string} slackId
 * @property {boolean} active
 * @property {Date} timestamp
 */


/**
 * Find recent host
 *
 * @param {Host[]} hosts
 * @returns {Host}
 */
getLastHost = (hosts) => hosts.reduce((a, b) => a.timestamp > b.timestamp ? a : b);


class Hosts {
  /**
   * @param {SpreadsheetApp.Sheet} sheet
   */
  constructor(sheet) {
    /** @private */
    this.sheet = sheet;
  }

  /**
   * Retrieve hosts from a sheet
   *
   * @returns {Host[]}
   */
  getAll() {
    const rows = this.sheet.getDataRange().getValues();

    const hosts = [];
    for (let i = 0; i < rows.length; i++) {
      const row = i + 1;
      const [name, slackId, active, timestamp] = rows[i];
      const host = {row, name, slackId, active, timestamp};
      if (host.slackId) {
        hosts.push(host);
      }
    }

    return hosts;
  }

  /**
   * Get range with a timestamp
   *
   * @private
   * @param {Host} host
   * @returns {SpreadsheetApp.Range}
   */
  getTimestampRange(host) {
    return /** @type {SpreadsheetApp.Range} */ this.sheet.getRange(host.row, TIMESTAMP_COLUMN);
  }

  /**
   * Get next and next after hosts from a queue
   * Use date as mark to calculate the next one
   *
   * @returns {[Host, Host]}
   */
  getNext() {
    const hosts = this.getAll();
    const last = getLastHost(hosts);
    const nextIndex = hosts.indexOf(last) + 1;
    const hostsCarrousel = [...hosts.slice(nextIndex), ...hosts.slice(0, nextIndex)];

    let next, nextAfter;
    for (const host of hostsCarrousel) {
      if (!next) this.getTimestampRange(host).setValue(new Date());

      if (host.active) {
        if (next) {
          nextAfter = host;
          break;
        } else {
          next = host;
        }
      }
    }

    return [next, nextAfter];
  }

  /**
   * Remove date from last host so it will be re-elected as next host again
   */
  skipMeeting() {
    const hosts = this.getAll();
    const last = getLastHost(hosts);
    this.getTimestampRange(last).clearContent();
  }
}
