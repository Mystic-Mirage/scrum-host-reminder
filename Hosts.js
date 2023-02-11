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
  const rows = sheet.getDataRange().getValues();

  const hosts = [];
  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    const [name, slackId, active, timestamp] = rows[i];
    const host = {idx, name, slackId, active, timestamp};
    if (host.slackId) {
      hosts.push(host);
    }
  }

  return hosts;
}


/**
 * Find recent host
 *
 * @param {Host[]} hosts
 * @returns {Host}
 */
function getLastHost(hosts) {
  return hosts.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
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

  const hosts = getHosts(sheet);
  const last = getLastHost(hosts);
  const nextIndex = hosts.indexOf(last) + 1;
  const hostsCarrousel = [...hosts.slice(nextIndex), ...hosts.slice(0, nextIndex)];

  for (const host of hostsCarrousel) {
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
 * Remove date from last host so it will be re-elected as next host again
 *
 * @param {SpreadsheetApp.Sheet} sheet
 */
function skipMeeting(sheet) {
  const hosts = getHosts(sheet);
  const last = getLastHost(hosts);
  sheet.getRange(last.idx, 4).clearContent();
}
