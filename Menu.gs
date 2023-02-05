function getStartOfWeek() {
  let date = new Date();
  let day = date.getDay();
  let diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0);

  return date;
}


/**
 * @param {string} channelId
 */
function newSheet(channelId) {
  let spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.insertSheet();
  let totalSheets = spreadsheet.getNumSheets();
  spreadsheet.moveActiveSheet(totalSheets);
  sheet.setName(channelId);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 20);

  sheet.getRange(1, 5, sheet.getMaxRows()).setBackground("#efefef");

  let startOfWeek = getStartOfWeek();
  sheet.getRange(1, 6).setValue(startOfWeek).setNumberFormat("yyyy-mm-dd");

  let timeRange = sheet.getRange(1, 7);
  let timeValidation = SpreadsheetApp.newDataValidation().requireDate().build();
  timeRange.setDataValidation(timeValidation);
  let timeFormatting = SpreadsheetApp.newConditionalFormatRule()
    .whenCellEmpty()
    .setBackground("#f4cccc")
    .setRanges([timeRange])
    .build();
  sheet.setConditionalFormatRules([timeFormatting]);

  let tzRangeSource = spreadsheet.getRange("timezones!A:A");
  let tzValidation = SpreadsheetApp.newDataValidation().requireValueInRange(tzRangeSource, false).build();
  sheet.getRange(1, 8).setDataValidation(tzValidation).setValue("UTC");

  sheet.getRange(...TRIGGER_UID_RANGE).setNote("Stored trigger UID. DO NOT REMOVE!");

  sheet.getRange(2, 6, 2, 7)
    .insertCheckboxes()
    .setValues(
      [
        [true, true, true, true, true, false, false],
        [true, true, true, true, true, false, false]
      ]
    );

  let members = getMembers(channelId);

  for (let i = 0; i < members.length; i++) {
    let userId = members[i];
    let name = getUserName(members[i]);
    let rowNum = i + 1;
    sheet.getRange(rowNum, 1, 1, 2).setValues([[name, userId]]);
    sheet.getRange(rowNum, 3).insertCheckboxes().setValue(true);
  }
}


function addChannel() {
  let ui = SpreadsheetApp.getUi();
  let result = ui.prompt("Enter Slack channel ID");
  let channelId = result.getResponseText();
  newSheet(channelId);
}


function onOpen() {
  let ui = SpreadsheetApp.getUi();
  ui.createMenu("Scrum Host Reminder")
    .addItem("Add Slack channel", addChannel.name)
    .addToUi();
}
