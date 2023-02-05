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
function getApiUrl(path) {
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
 * @param {Object} data
 */
function postApi(path, token, data) {
  let url = getApiUrl(path);
  post(url, token, data);
}


/**
 * @param {string} slackId
 * @param {string} [responseUrl]
 */
function postMessage(slackId, responseUrl) {
  let props = getScriptProperties();
  let data = {
    channel: props.SLACK_CHANNEL_ID,
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

  if (responseUrl) {
    data.replace_original = true;
    post(responseUrl, props.SLACK_TOKEN, data);
  } else {
    postApi("chat.postMessage", props.SLACK_TOKEN, data);
  }
}


/**
 * @parameter {string} channelId
 * @parameter {string} token
 * @parameter {string} [nextCursor]
 * @returns {Object[]}
 */
function readHistory(channelId, token, nextCursor) {
  let url = getApiUrl("conversations.history") + "?channel=" + channelId;
  if (nextCursor) {
    url += "&cursor=" + nextCursor;
  }
  let params = prepareFetchParams(token);

  let response = UrlFetchApp.fetch(url, params);
  let result = JSON.parse(response);
  return result;
}


function deleteLastMessage() {
  let props = getScriptProperties();

  let nextCursor;
  for (let repeat = 0; repeat < 10; repeat++) {
    let history = readHistory(props.SLACK_CHANNEL_ID, props.SLACK_TOKEN, nextCursor);
    for (let i = 0; i < history.messages.length; i++) {
      let message = history.messages[i];
      if (message.app_id === props.SLACK_APP_ID) {
        let data = {
          channel: props.SLACK_CHANNEL_ID,
          ts: message.ts,
        }

        postApi("chat.delete", props.SLACK_TOKEN, data);
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
