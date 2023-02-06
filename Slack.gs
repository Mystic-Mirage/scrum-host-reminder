/**
 * @returns {Object}
 */
function getScriptProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}


/**
 * @param {string} path
 * @returns {string}
 */
function apiUrl(path) {
  return "https://slack.com/api/" + path;
}


/**
 * @param {Object} [data]
 * @returns {Object}
 */
function prepareFetchParams(token, data) {
  let params = {
    contentType: "application/json; charset=utf-8",
    headers: {Authorization: "Bearer " + token},
  };
  return {...params, ...data};
}


/**
 * @param {string} url
 * @param {Object} data
 */
function post(url, token, data) {
  let params = prepareFetchParams(
    token,
    {
      method: "post",
      payload: JSON.stringify(data),
    }
  );

  UrlFetchApp.fetch(url, params);
}


/**
 * @param {string} path
 * @param {string} token
 * @param {Object} data
 */
function postApi(path, token, data) {
  let url = apiUrl(path);
  post(url, token, data);
}


/**
 * @param {string} path
 * @param {string} argString
 * @param {string} token
 * @returns {Object[]}
 */
function getApi(path, argString, token) {
  let url = apiUrl(path) + argString;
  let params = prepareFetchParams(token);

  let response = UrlFetchApp.fetch(url, params);
  let result = JSON.parse(response);
  return result;
}


/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} [nextCursor]
 * @returns {Object[]}
 */
function readHistory(channelId, token, nextCursor) {
  let argString = "?channel=" + channelId;
  if (nextCursor) {
    url += "&cursor=" + nextCursor;
  }

  let result = getApi("conversations.history", argString, token);

  return result;
}


/**
 * @param {string} channelId
 * @returns {Object[]}
 */
function getMembers(channelId) {
  let props = getScriptProperties();

  let argString = "?channel=" + channelId + "&limit=20"
  let members = getApi("conversations.members", argString, props.SLACK_TOKEN).members;

  return members;
}


/**
 * @typedef {Object} User
 * @property {string} real_name
 * @property {boolean} is_bot
 */


/**
 * @param {string} userId
 * @returns {User}
 */
function getUserInfo(userId) {
  let props = getScriptProperties();

  let user = getApi("users.info", "?user=" + userId, props.SLACK_TOKEN).user;
  return user;
}


/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} appId
 */
function deleteLastMessage(channelId, token, appId) {
  let nextCursor;

  for (let repeat = 0; repeat < 10; repeat++) {
    let history = readHistory(channelId, token, nextCursor);

    if (!history.messages) return;

    for (let message of history.messages) {
      if (message.app_id === appId) {
        let data = {
          channel: channelId,
          ts: message.ts,
        }

        postApi("chat.delete", token, data);
        return;
      }
    }

    if (!history.has_more) break;

    nextCursor = history.response_metadata.next_cursor;
  }
}


/**
 * @param {string} responseUrl
 */
function deleteOriginalMessage(responseUrl) {
  let props = getScriptProperties();
  let data = {
    delete_original: true,
  };
  post(responseUrl, props.SLACK_TOKEN, data);
}


/**
 * @param {string} channelId
 * @param {string} slackId
 * @param {Object} params
 * @param {string} [params.channelId]
 * @param {string} [params.responseUrl]
 */
function postMessage(slackId, params) {
  let props = getScriptProperties();

  let data = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Hello! Today's daily meeting host is <@" + slackId + ">",
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Skip the meeting",
            },
            style: "danger",
            confirm: {
              title: {
                  type: "plain_text",
                  text: "Skip the meeting?"
              },
              text: {
                  type: "plain_text",
                  text: "Re-select today's host for the next meeting",
              },
              confirm: {
                  type: "plain_text",
                  text: "Yes",
              },
              deny: {
                  type: "plain_text",
                  text: "No",
              }
            },
            action_id: "skip-meeting",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Next host",
            },
            style: "primary",
            confirm: {
              title: {
                  type: "plain_text",
                  text: "Next host?"
              },
              text: {
                  type: "plain_text",
                  text: "Select a new host for today's meeting",
              },
              confirm: {
                  type: "plain_text",
                  text: "Yes",
              },
              deny: {
                  type: "plain_text",
                  text: "No",
              }
            },
            action_id: "next-host",
          }
        ]
      }
    ]
  };

  if (params.responseUrl) {
    data.replace_original = true;
    post(params.responseUrl, props.SLACK_TOKEN, data);
  } else if (params.channelId) {
    deleteLastMessage(params.channelId, props.SLACK_TOKEN, props.SLACK_APP_ID);
    data.channel = params.channelId;
    postApi("chat.postMessage", props.SLACK_TOKEN, data);
  }
}


/**
 * @param {string} channelId
 */
function joinChannel(channelId) {
  let props = getScriptProperties();

  let data = {
    channel: channelId,
  }

  postApi("conversations.join", props.SLACK_TOKEN, data);
}


/**
 * @param {string} channelId
 * @returns {boolean}
 */
function checkChannel(channelId) {
  let props = getScriptProperties();

  let result = getApi("conversations.info", "?channel=" + channelId, props.SLACK_TOKEN);
  return result.ok;
}


function debugGetMembers() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  console.log(getMembers(sheet.getName()));
}


function debugGetUserName() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  let userId = sheet.getRange(1, 2).getValue();
  console.log(getUserName(userId));
}
