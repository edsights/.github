name: Post Release to Slack

on:
  workflow_call:
    secrets:
      SLACK_WEBHOOK_URL_RELEASES:
        required: true

jobs:
  slack_notification:
    runs-on: ubuntu-latest
    steps:
      - name: Post Release Notes to Slack
        uses: slackapi/slack-github-action@v1.27.1
        with:
          payload: |
            {
              "text": "*New Release Created: ${{ github.repository }}!* 🚀",
              "attachments": [
                {
                  "color": "#145aff",
                  "title": "${{ github.event.release.name }}",
                  "title_link": "${{ github.event.release.html_url }}",
                  "text": ${{ toJson(github.event.release.body) }},
                  "footer": "GitHub Releases",
                  "footer_icon": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL_RELEASES }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
