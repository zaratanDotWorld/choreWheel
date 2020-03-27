exports.list = function() {
  return {

    "type": "modal",
    "callback_id": "modal_list",
    "title": {
      "type": "plain_text",
      "text": "Chores",
      "emoji": true
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit",
      "emoji": true
    },
    "close": {
      "type": "plain_text",
      "text": "Cancel",
      "emoji": true
    },
    "blocks": [
      {
        "type": "input",
        "block_id": "chore_input",
        "label": {
          "type": "plain_text",
          "text": "🧹 Choose a chore",
          "emoji": true
        },
        "element": {
          "type": "static_select",
          "action_id": "chore_select",
          "placeholder": {
            "type": "plain_text",
            "text": "...",
            "emoji": true
          },
          "options": getOptions()
        }
      }
    ]

  }
}

const options = [
  "Sweeping",
  "Dishes",
  "Restock",
]

function getOptions() {
  return options.map(option => {
    return {
      "text": {
        "type": "plain_text",
        "text": option,
        "emoji": true
      },
      "value": option
    }
  })
}
