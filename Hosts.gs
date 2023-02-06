/**
 * @typedef {Object} Host
 * @property {number} idx
 * @property {string} name
 * @property {string} slackId
 * @property {boolean} active
 * @property {Date} timestamp
 */


/**
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} sortKey
 * @returns {Host[]}
 */
function getHosts(sheet, sortKey = "timestamp") {
  let rows = sheet.getDataRange().getValues();

  let hosts = [];

  for (let i = 0; i < rows.length; i++) {
    let idx = i +1;
    let [name, slackId, active, timestamp] = rows[i];
    let host = {idx, name, slackId, active, timestamp};
    if (host.slackId) {
      hosts.push(host);
    }
  }

  hosts.sort(function (a, b) {
    if (a[sortKey] < b[sortKey]) return -1;
    if (a[sortKey] > b[sortKey]) return 1;
    return 0;
  });

  return hosts;
}


/**
 * @param {SpreadsheetApp.Sheet} sheet
 * @returns {Host}
 */
function nextHost(sheet) {
  let now = new Date();

  let hosts = getHosts(sheet);

  for (let i = 0; i < hosts.length; i++) {
    let host = hosts[i];
    sheet.getRange(host.idx, 4).setValue(now);

    if (host.active) {
      return host;
    }
  }
}


/**
 * @param {SpreadsheetApp.Sheet} sheet
 */
function skipMeeting(sheet) {
  let hosts = getHosts(sheet);

  let host = hosts[hosts.length - 1];
  sheet.getRange(host.idx, 4).clearContent();
}
