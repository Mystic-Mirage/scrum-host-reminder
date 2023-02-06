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
  sheet.getRange(1, 4, sheet.getMaxRows()).setNumberFormat("yyyy-mm-dd hh:mm:ss")
  sheet.setColumnWidth(5, 20);

  sheet.getRange(1, 5, sheet.getMaxRows()).setBackground("#efefef");

  let startOfWeek = getStartOfWeek();
  sheet.getRange(1, 6).setValue(startOfWeek).setNumberFormat("yyyy-mm-dd");

  let timeRange = sheet.getRange(1, 7);
  timeRange.setNumberFormat("hh:mm");
  let timeValidation = SpreadsheetApp.newDataValidation().requireDate().build();
  timeRange.setDataValidation(timeValidation);
  let timeFormatting = SpreadsheetApp.newConditionalFormatRule()
    .whenCellEmpty()
    .setBackground("#f4cccc")
    .setRanges([timeRange])
    .build();
  sheet.setConditionalFormatRules([timeFormatting]);

  let tzRangeSource = spreadsheet.getRange("timezones!A:A");
  let tzValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(tzRangeSource, false)
    .setAllowInvalid(false)
    .build();
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

  if (members = getMembers(channelId)) {
    let rowNum = 0;
    for (let i = 0; i < members.length; i++) {
      let userId = members[i];
      let user = getUserInfo(members[i]);
      if (!user.is_bot) {
        rowNum++;
        sheet.getRange(rowNum, 1, 1, 2).setValues([[user.real_name, userId]]);
        sheet.getRange(rowNum, 3).insertCheckboxes();
      }
    }
  }
}


function addChannel() {
  let ui = SpreadsheetApp.getUi();
  let result = ui.prompt("Enter Slack channel ID");
  let channelId = result.getResponseText();

  if (!channelId) return;

  if (!checkChannel(channelId)) {
    ui.alert("Wrong channel ID", "Note: add the bot first if a channel is private", ui.ButtonSet.OK);
    return;
  }

  newSheet(channelId);
  joinChannel(channelId);
}


function onOpen() {
  let ui = SpreadsheetApp.getUi();
  ui.createMenu("Scrum Host Reminder")
    .addItem("Add Slack channel", addChannel.name)
    .addToUi();
}
