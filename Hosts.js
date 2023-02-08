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
 * @param {SpreadsheetApp.Sheet} sheet
 * @returns {Host[]}
 */
function nextHosts(sheet) {
  let next, afterNext;

  let hosts = getHosts(sheet);
  let last = hosts.reduce(function (a, b) {return a.timestamp > b.timestamp ? a : b});
  let nextIndex = hosts.indexOf(last) + 1;
  let hostsCarrousel = [...hosts.slice(nextIndex), ...hosts.slice(0, nextIndex)];

  for (let host of hostsCarrousel) {
    if (!next) sheet.getRange(host.idx, 4).setValue(new Date());

    if (host.active) {
      if (next) {
        afterNext = host;
        break;
      } else {
        next = host;
      }
    }
  }

  return [next, afterNext];
}


/**
 * @param {SpreadsheetApp.Sheet} sheet
 */
function skipMeeting(sheet) {
  let hosts = getHosts(sheet);

  let host = hosts[hosts.length - 1];
  sheet.getRange(host.idx, 4).clearContent();
}
