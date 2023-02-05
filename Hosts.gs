/**
 * @returns {Object}
 */
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("hosts");
}


/**
 * @param {Object} sheet
 * @returns {Object[]}
 */
function getHosts(sheet) {
  let rows = sheet.getDataRange().getValues();

  let hosts = [];

  for (let i = 0; i < rows.length; i++) {
    let idx = i +1;
    let [name, slackId, active, timestamp] = rows[i];
    let host = {idx, name, slackId, active, timestamp};
    hosts.push(host);
  }

  hosts.sort(function(a, b) {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  })

  return hosts;
}


/**
 * @returns {Object}
 */
function nextHost() {
  let now = new Date();

  let sheet = getSheet();
  let hosts = getHosts(sheet);

  let next = null;
  for (let i = 0; i < hosts.length; i++) {
    let host = hosts[i];
    sheet.getRange(host.idx, 4).setValue(now);

    if (host.active) {
      next = host;
      break;
    }
  }

  return next;
}


function skipMeeting() {
  let sheet = getSheet()
  let hosts = getHosts(sheet);

  let host = hosts[hosts.length - 1];
  sheet.getRange(host.idx, 4).clearContent();
}
