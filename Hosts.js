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
    /** @type {Host[]} */
    this.all = [];

    const rows = this.sheet.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
      const row = i + 1;
      const [name, slackId, active, timestamp] = rows[i];
      const host = {row, name, slackId, active, timestamp};
      if (host.slackId) {
        this.all.push(host);
      }
    }
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
    const last = getLastHost(this.all);
    const nextIndex = this.all.indexOf(last) + 1;
    const hostsCarrousel = [...this.all.slice(nextIndex), ...this.all.slice(0, nextIndex)];

    let next, nextAfter;
    for (const host of hostsCarrousel) {
      if (!next) {
        this.getTimestampRange(host).setValue(new Date());
      }

      if (host.active) {
        if (next) {
          nextAfter = host;
          break;
        } else {
          next = host;
        }
      }
    }

    SpreadsheetApp.flush();
    return [next, nextAfter];
  }

  /**
   * Remove date from last host so it will be re-elected as next host again
   */
  skipMeeting() {
    const last = getLastHost(this.all);
    this.getTimestampRange(last).clearContent();
    SpreadsheetApp.flush();
  }
}
