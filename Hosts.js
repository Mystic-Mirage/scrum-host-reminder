/**
 * @typedef {Object} Host
 * @property {number} idx
 * @property {string} name
 * @property {string} slackId
 * @property {boolean} active
 * @property {Date} timestamp
 */


/**
 * Retrieve hosts from a sheet
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @returns {Host[]}
 */
function getHosts(sheet) {
  let rows = sheet.getDataRange().getValues();

  let hosts = [];
  for (let i = 0; i < rows.length; i++) {
    let idx = i + 1;
    let [name, slackId, active, timestamp] = rows[i];
    let host = {idx, name, slackId, active, timestamp};
    if (host.slackId) {
      hosts.push(host);
    }
  }

  return hosts;
}


/**
 * Get next and next after hosts from a queue
 * Use date as mark to calculate the next one
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @returns {[Host, Host]}
 */
function nextHosts(sheet) {
  let next, nextAfter;

  let hosts = getHosts(sheet);
  let last = hosts.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
  let nextIndex = hosts.indexOf(last) + 1;
  let hostsCarrousel = [...hosts.slice(nextIndex), ...hosts.slice(0, nextIndex)];

  for (let host of hostsCarrousel) {
    if (!next) sheet.getRange(host.idx, 4).setValue(new Date());

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
 * Remove date from current host so it will be re-elected as next host again
 *
 * @param {SpreadsheetApp.Sheet} sheet
 */
function skipMeeting(sheet) {
  let hosts = getHosts(sheet);

  let host = hosts[hosts.length - 1];
  sheet.getRange(host.idx, 4).clearContent();
}
